#!/usr/bin/env python3
"""
A/B Testing Framework for AIFX_v2 ML Engine

Provides user assignment, experiment tracking, and performance comparison
between different model versions.

Author: AI-assisted
Created: 2025-10-16
"""

import hashlib
import json
import logging
from typing import Dict, Optional, List, Tuple
from datetime import datetime
from pathlib import Path
from collections import defaultdict

logger = logging.getLogger(__name__)


class ABExperiment:
    """
    Represents an A/B test experiment
    """

    def __init__(self, experiment_id: str, name: str, description: str,
                 variant_a: str, variant_b: str, traffic_split: float = 0.5):
        """
        Initialize A/B experiment

        Args:
            experiment_id: Unique experiment identifier
            name: Experiment name
            description: Experiment description
            variant_a: Model version for variant A (e.g., 'v3.0')
            variant_b: Model version for variant B (e.g., 'v3.1')
            traffic_split: Percentage of traffic for variant A (0.0-1.0)
        """
        self.experiment_id = experiment_id
        self.name = name
        self.description = description
        self.variant_a = variant_a
        self.variant_b = variant_b
        self.traffic_split = traffic_split
        self.start_time = datetime.utcnow()
        self.end_time = None
        self.active = True

        # Metrics tracking
        self.predictions = defaultdict(lambda: {
            'count': 0,
            'signals': {'long': 0, 'short': 0, 'hold': 0},
            'avg_confidence': 0.0,
            'total_confidence': 0.0
        })

    def assign_variant(self, user_id: str) -> str:
        """
        Assign a user to a variant using consistent hashing

        Args:
            user_id: User identifier

        Returns:
            str: Variant identifier ('A' or 'B')
        """
        # Consistent hashing: hash user_id + experiment_id
        hash_input = f"{user_id}:{self.experiment_id}".encode('utf-8')
        hash_value = int(hashlib.md5(hash_input).hexdigest(), 16)
        normalized = (hash_value % 10000) / 10000  # Normalize to 0.0-1.0

        return 'A' if normalized < self.traffic_split else 'B'

    def get_model_version(self, user_id: str) -> str:
        """
        Get the model version for a user

        Args:
            user_id: User identifier

        Returns:
            str: Model version identifier
        """
        variant = self.assign_variant(user_id)
        return self.variant_a if variant == 'A' else self.variant_b

    def record_prediction(self, variant: str, signal: str, confidence: float):
        """
        Record a prediction result for metrics

        Args:
            variant: Variant identifier ('A' or 'B')
            signal: Prediction signal ('long', 'short', 'hold')
            confidence: Prediction confidence (0.0-1.0)
        """
        metrics = self.predictions[variant]
        metrics['count'] += 1
        metrics['signals'][signal] += 1
        metrics['total_confidence'] += confidence
        metrics['avg_confidence'] = metrics['total_confidence'] / metrics['count']

    def get_metrics(self) -> Dict:
        """Get experiment metrics"""
        return {
            'experiment_id': self.experiment_id,
            'name': self.name,
            'active': self.active,
            'start_time': self.start_time.isoformat() + 'Z',
            'end_time': self.end_time.isoformat() + 'Z' if self.end_time else None,
            'variants': {
                'A': {
                    'model_version': self.variant_a,
                    'traffic_split': self.traffic_split,
                    'metrics': dict(self.predictions['A'])
                },
                'B': {
                    'model_version': self.variant_b,
                    'traffic_split': 1.0 - self.traffic_split,
                    'metrics': dict(self.predictions['B'])
                }
            }
        }

    def stop(self):
        """Stop the experiment"""
        self.active = False
        self.end_time = datetime.utcnow()
        logger.info(f"Experiment {self.experiment_id} stopped at {self.end_time}")


class ABTestingFramework:
    """
    A/B Testing Framework for model version experiments
    """

    def __init__(self, experiments_dir: str = None):
        """
        Initialize A/B testing framework

        Args:
            experiments_dir: Directory to store experiment data
        """
        if experiments_dir is None:
            base_dir = Path(__file__).parent.parent
            experiments_dir = base_dir / 'data' / 'experiments'

        self.experiments_dir = Path(experiments_dir)
        self.experiments_dir.mkdir(parents=True, exist_ok=True)

        self.experiments: Dict[str, ABExperiment] = {}
        self.active_experiment: Optional[str] = None

        logger.info(f"A/B Testing Framework initialized (dir: {self.experiments_dir})")

        # Load existing experiments
        self._load_experiments()

    def create_experiment(self, experiment_id: str, name: str, description: str,
                         variant_a: str, variant_b: str, traffic_split: float = 0.5) -> ABExperiment:
        """
        Create a new A/B test experiment

        Args:
            experiment_id: Unique experiment identifier
            name: Experiment name
            description: Experiment description
            variant_a: Model version for variant A
            variant_b: Model version for variant B
            traffic_split: Traffic split for variant A (default: 0.5)

        Returns:
            ABExperiment: Created experiment
        """
        if experiment_id in self.experiments:
            logger.warning(f"Experiment {experiment_id} already exists")
            return self.experiments[experiment_id]

        experiment = ABExperiment(
            experiment_id=experiment_id,
            name=name,
            description=description,
            variant_a=variant_a,
            variant_b=variant_b,
            traffic_split=traffic_split
        )

        self.experiments[experiment_id] = experiment
        self._save_experiment(experiment)

        logger.info(f"Created experiment: {experiment_id} ({variant_a} vs {variant_b})")

        return experiment

    def activate_experiment(self, experiment_id: str) -> bool:
        """
        Activate an experiment

        Args:
            experiment_id: Experiment identifier

        Returns:
            bool: True if successful, False otherwise
        """
        if experiment_id not in self.experiments:
            logger.error(f"Experiment {experiment_id} not found")
            return False

        # Deactivate current experiment if any
        if self.active_experiment:
            old_exp = self.experiments[self.active_experiment]
            old_exp.stop()
            self._save_experiment(old_exp)

        # Activate new experiment
        self.active_experiment = experiment_id
        self.experiments[experiment_id].active = True

        logger.info(f"Activated experiment: {experiment_id}")
        return True

    def get_model_version_for_user(self, user_id: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Get the model version for a user based on active experiment

        Args:
            user_id: User identifier

        Returns:
            tuple: (model_version, experiment_id) or (None, None) if no active experiment
        """
        if not self.active_experiment:
            return None, None

        experiment = self.experiments[self.active_experiment]
        model_version = experiment.get_model_version(user_id)
        variant = experiment.assign_variant(user_id)

        logger.debug(f"User {user_id} → Variant {variant} → Model {model_version}")

        return model_version, self.active_experiment

    def record_prediction(self, experiment_id: str, user_id: str,
                         signal: str, confidence: float):
        """
        Record a prediction result for an experiment

        Args:
            experiment_id: Experiment identifier
            user_id: User identifier
            signal: Prediction signal
            confidence: Prediction confidence
        """
        if experiment_id not in self.experiments:
            logger.warning(f"Experiment {experiment_id} not found")
            return

        experiment = self.experiments[experiment_id]
        variant = experiment.assign_variant(user_id)
        experiment.record_prediction(variant, signal, confidence)

        # Periodically save experiment data (every 10 predictions)
        if experiment.predictions[variant]['count'] % 10 == 0:
            self._save_experiment(experiment)

    def get_experiment_metrics(self, experiment_id: str) -> Optional[Dict]:
        """
        Get metrics for an experiment

        Args:
            experiment_id: Experiment identifier

        Returns:
            dict: Experiment metrics or None if not found
        """
        if experiment_id not in self.experiments:
            return None

        return self.experiments[experiment_id].get_metrics()

    def list_experiments(self) -> List[Dict]:
        """List all experiments with basic info"""
        return [
            {
                'experiment_id': exp_id,
                'name': exp.name,
                'active': exp.active,
                'variants': f"{exp.variant_a} vs {exp.variant_b}",
                'start_time': exp.start_time.isoformat() + 'Z'
            }
            for exp_id, exp in self.experiments.items()
        ]

    def stop_experiment(self, experiment_id: str) -> bool:
        """
        Stop an experiment

        Args:
            experiment_id: Experiment identifier

        Returns:
            bool: True if successful, False otherwise
        """
        if experiment_id not in self.experiments:
            logger.error(f"Experiment {experiment_id} not found")
            return False

        experiment = self.experiments[experiment_id]
        experiment.stop()
        self._save_experiment(experiment)

        if self.active_experiment == experiment_id:
            self.active_experiment = None

        logger.info(f"Stopped experiment: {experiment_id}")
        return True

    def _save_experiment(self, experiment: ABExperiment):
        """Save experiment data to disk"""
        file_path = self.experiments_dir / f"{experiment.experiment_id}.json"

        data = {
            'experiment_id': experiment.experiment_id,
            'name': experiment.name,
            'description': experiment.description,
            'variant_a': experiment.variant_a,
            'variant_b': experiment.variant_b,
            'traffic_split': experiment.traffic_split,
            'start_time': experiment.start_time.isoformat() + 'Z',
            'end_time': experiment.end_time.isoformat() + 'Z' if experiment.end_time else None,
            'active': experiment.active,
            'predictions': {
                variant: dict(metrics)
                for variant, metrics in experiment.predictions.items()
            }
        }

        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)

        logger.debug(f"Saved experiment: {experiment.experiment_id}")

    def _load_experiments(self):
        """Load experiments from disk"""
        if not self.experiments_dir.exists():
            return

        for file_path in self.experiments_dir.glob('*.json'):
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)

                # Reconstruct experiment
                experiment = ABExperiment(
                    experiment_id=data['experiment_id'],
                    name=data['name'],
                    description=data['description'],
                    variant_a=data['variant_a'],
                    variant_b=data['variant_b'],
                    traffic_split=data['traffic_split']
                )

                experiment.start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
                if data['end_time']:
                    experiment.end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
                experiment.active = data['active']

                # Restore predictions
                for variant, metrics in data.get('predictions', {}).items():
                    experiment.predictions[variant] = metrics

                self.experiments[experiment.experiment_id] = experiment

                if experiment.active:
                    self.active_experiment = experiment.experiment_id

                logger.info(f"Loaded experiment: {experiment.experiment_id}")

            except Exception as e:
                logger.error(f"Failed to load experiment from {file_path}: {e}")


def main():
    """Test A/B testing framework"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    logger.info("="*80)
    logger.info("Testing A/B Testing Framework")
    logger.info("="*80)

    # Create framework
    framework = ABTestingFramework()

    # Create experiment
    logger.info("\n### Creating experiment ###")
    exp = framework.create_experiment(
        experiment_id='v30_vs_v31',
        name='Swing Point vs Profitable Logic',
        description='Compare v3.0 (Swing Point) with v3.1 (Profitable Logic)',
        variant_a='v3.0',
        variant_b='v3.1',
        traffic_split=0.5
    )

    # Activate experiment
    framework.activate_experiment('v30_vs_v31')

    # Simulate user assignments
    logger.info("\n### Simulating user assignments ###")
    users = ['user1', 'user2', 'user3', 'user4', 'user5']

    for user_id in users:
        model_version, exp_id = framework.get_model_version_for_user(user_id)
        logger.info(f"  {user_id} → {model_version}")

        # Simulate predictions
        framework.record_prediction(exp_id, user_id, 'long', 0.75)

    # Get metrics
    logger.info("\n### Experiment metrics ###")
    metrics = framework.get_experiment_metrics('v30_vs_v31')
    logger.info(json.dumps(metrics, indent=2))

    # List experiments
    logger.info("\n### All experiments ###")
    experiments = framework.list_experiments()
    for exp in experiments:
        logger.info(f"  {exp['experiment_id']}: {exp['name']} ({exp['variants']})")

    logger.info("\n" + "="*80)
    logger.info("✅ A/B Testing Framework test completed")
    logger.info("="*80)


if __name__ == '__main__':
    main()
