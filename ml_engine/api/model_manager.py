#!/usr/bin/env python3
"""
Model Version Manager for AIFX_v2 ML Engine

Manages multiple model versions and provides version switching capabilities.
Supports A/B testing and model performance tracking.

Author: AI-assisted
Created: 2025-10-16
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime
import tensorflow as tf
from tensorflow import keras
import pickle

logger = logging.getLogger(__name__)


class ModelVersion:
    """
    Represents a single model version with metadata
    """

    def __init__(self, version: str, name: str, description: str,
                 stage1_path: str, stage2_path: str = None,
                 scaler_path: str = None, features_path: str = None,
                 metadata_path: str = None, threshold: float = 0.5):
        """
        Initialize model version

        Args:
            version: Version identifier (e.g., 'v3.0', 'v3.1')
            name: Human-readable name
            description: Model description
            stage1_path: Path to Stage 1 model (.h5 file)
            stage2_path: Path to Stage 2 model (.h5 file)
            scaler_path: Path to feature scaler (.pkl file)
            features_path: Path to selected features (.json file)
            metadata_path: Path to metadata (.json file)
            threshold: Stage 1 threshold for reversal detection
        """
        self.version = version
        self.name = name
        self.description = description
        self.stage1_path = stage1_path
        self.stage2_path = stage2_path
        self.scaler_path = scaler_path
        self.features_path = features_path
        self.metadata_path = metadata_path
        self.threshold = threshold

        # Loaded models and components
        self.stage1_model = None
        self.stage2_model = None
        self.scaler = None
        self.features = None
        self.metadata = None

        # Performance metrics
        self.metrics = {}

    def load(self) -> bool:
        """
        Load all model components

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            logger.info(f"Loading model version {self.version} ({self.name})")

            # Load Stage 1 model
            if self.stage1_path and os.path.exists(self.stage1_path):
                logger.info(f"  Loading Stage 1 from {self.stage1_path}")
                self.stage1_model = keras.models.load_model(
                    self.stage1_path,
                    compile=False
                )
                logger.info(f"  ✅ Stage 1 loaded: {self.stage1_model.count_params():,} parameters")
            else:
                logger.warning(f"  ⚠️ Stage 1 model not found: {self.stage1_path}")
                return False

            # Load Stage 2 model (optional for some versions)
            if self.stage2_path and os.path.exists(self.stage2_path):
                logger.info(f"  Loading Stage 2 from {self.stage2_path}")
                self.stage2_model = keras.models.load_model(
                    self.stage2_path,
                    compile=False
                )
                logger.info(f"  ✅ Stage 2 loaded: {self.stage2_model.count_params():,} parameters")
            else:
                logger.info(f"  ⚠️ Stage 2 model not available (may be trained later)")

            # Load scaler
            if self.scaler_path and os.path.exists(self.scaler_path):
                try:
                    logger.info(f"  Loading scaler from {self.scaler_path}")
                    with open(self.scaler_path, 'rb') as f:
                        self.scaler = pickle.load(f)
                    logger.info(f"  ✅ Scaler loaded")
                except Exception as e:
                    logger.warning(f"  ⚠️ Failed to load scaler: {e}")
                    logger.warning(f"  Model will work without scaler (features should be pre-normalized)")

            # Load features
            if self.features_path and os.path.exists(self.features_path):
                logger.info(f"  Loading features from {self.features_path}")
                with open(self.features_path, 'r') as f:
                    features_data = json.load(f)
                    # Handle both list and dict formats
                    if isinstance(features_data, dict):
                        self.features = features_data.get('features', [])
                    else:
                        self.features = features_data
                num_features = len(self.features) if isinstance(self.features, list) else self.features.get('num_features', 0)
                logger.info(f"  ✅ Features loaded: {num_features} features")

            # Load metadata
            if self.metadata_path and os.path.exists(self.metadata_path):
                logger.info(f"  Loading metadata from {self.metadata_path}")
                with open(self.metadata_path, 'r') as f:
                    self.metadata = json.load(f)
                    self.metrics = self.metadata.get('metrics', {})
                logger.info(f"  ✅ Metadata loaded")

            logger.info(f"✅ Model version {self.version} loaded successfully")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to load model version {self.version}: {e}")
            return False

    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self.stage1_model is not None

    def get_info(self) -> Dict:
        """Get model version information"""
        return {
            'version': self.version,
            'name': self.name,
            'description': self.description,
            'threshold': self.threshold,
            'loaded': self.is_loaded(),
            'has_stage2': self.stage2_model is not None,
            'num_features': len(self.features) if self.features else None,
            'metrics': self.metrics,
            'metadata': self.metadata
        }


class ModelManager:
    """
    Manages multiple model versions and provides version switching
    """

    def __init__(self, models_dir: str = None):
        """
        Initialize model manager

        Args:
            models_dir: Base directory for trained models
        """
        if models_dir is None:
            # Default to ml_engine/models/trained/
            base_dir = Path(__file__).parent.parent
            models_dir = base_dir / 'models' / 'trained'

        self.models_dir = Path(models_dir)
        self.versions: Dict[str, ModelVersion] = {}
        self.active_version: Optional[str] = None

        logger.info(f"Model Manager initialized with models_dir: {self.models_dir}")

        # Register available model versions
        self._register_versions()

    def _register_versions(self):
        """Register all available model versions"""

        # Version 3.0 - Swing Point (Original)
        v30 = ModelVersion(
            version='v3.0',
            name='Swing Point Detector',
            description='Original two-stage model with swing high/low detection',
            stage1_path=str(self.models_dir / 'reversal_detector_stage1.h5'),
            stage2_path=str(self.models_dir / 'direction_classifier_stage2.h5'),
            scaler_path=str(self.models_dir / 'feature_scaler.pkl'),
            features_path=str(self.models_dir / 'selected_features.json'),
            metadata_path=str(self.models_dir / 'stage1_metadata.json'),
            threshold=0.2  # Optimized threshold from threshold optimization
        )
        self.register_version(v30)

        # Version 3.1 - Profitable Logic (Breakthrough)
        v31 = ModelVersion(
            version='v3.1',
            name='Profitable Reversal Detector',
            description='Profitable logic model - 79% recall, 61% precision',
            stage1_path=str(self.models_dir / 'profitable_reversal_detector_stage1.h5'),
            stage2_path=str(self.models_dir / 'direction_classifier_stage2.h5'),  # Will be updated
            scaler_path=str(self.models_dir / 'profitable_feature_scaler.pkl'),
            features_path=str(self.models_dir / 'profitable_selected_features.json'),
            metadata_path=str(self.models_dir / 'profitable_stage1_metadata.json'),
            threshold=0.5  # Default threshold for profitable model
        )
        self.register_version(v31)

        # Version 3.2 - Real yfinance Data (38 Features)
        v32 = ModelVersion(
            version='v3.2',
            name='Real Market Data Detector',
            description='Trained on real yfinance data with 38 comprehensive technical indicators',
            stage1_path=str(self.models_dir / 'reversal_mode1_model.h5'),
            stage2_path=None,  # Stage 2 not yet trained on real data
            scaler_path=str(self.models_dir / 'reversal_mode1_scaler.pkl'),
            features_path=str(self.models_dir / 'reversal_mode1_features.json'),
            metadata_path=str(self.models_dir / 'reversal_mode1_metadata.json'),
            threshold=0.5  # Default threshold, can be optimized later
        )
        self.register_version(v32)

        logger.info(f"Registered {len(self.versions)} model versions")

    def register_version(self, version: ModelVersion):
        """
        Register a new model version

        Args:
            version: ModelVersion instance
        """
        self.versions[version.version] = version
        logger.info(f"Registered model version: {version.version} ({version.name})")

    def load_version(self, version: str) -> bool:
        """
        Load a specific model version

        Args:
            version: Version identifier (e.g., 'v3.0', 'v3.1')

        Returns:
            bool: True if successful, False otherwise
        """
        if version not in self.versions:
            logger.error(f"Model version {version} not registered")
            return False

        model_version = self.versions[version]
        success = model_version.load()

        if success:
            self.active_version = version
            logger.info(f"Active model version: {version}")

        return success

    def get_active_version(self) -> Optional[ModelVersion]:
        """Get the currently active model version"""
        if self.active_version:
            return self.versions[self.active_version]
        return None

    def get_version(self, version: str) -> Optional[ModelVersion]:
        """Get a specific model version"""
        return self.versions.get(version)

    def list_versions(self) -> List[str]:
        """List all registered model versions"""
        return list(self.versions.keys())

    def get_versions_info(self) -> Dict:
        """Get information about all registered versions"""
        return {
            'active_version': self.active_version,
            'versions': {
                ver: model.get_info()
                for ver, model in self.versions.items()
            }
        }

    def switch_version(self, version: str) -> bool:
        """
        Switch to a different model version

        Args:
            version: Version identifier

        Returns:
            bool: True if successful, False otherwise
        """
        logger.info(f"Switching model version: {self.active_version} → {version}")
        return self.load_version(version)

    def auto_load_best_version(self) -> bool:
        """
        Automatically load the best performing version
        Currently defaults to v3.2 (Real Market Data)

        Returns:
            bool: True if successful, False otherwise
        """
        logger.info("Auto-loading best model version...")

        # Try v3.2 first (trained on real yfinance data)
        if self.load_version('v3.2'):
            logger.info("✅ Loaded v3.2 (Real Market Data - 38 features)")
            return True

        # Fallback to v3.1
        logger.warning("v3.2 not available, falling back to v3.1")
        if self.load_version('v3.1'):
            return True

        # Final fallback to v3.0
        logger.warning("v3.1 not available, falling back to v3.0")
        return self.load_version('v3.0')


def main():
    """Test model manager"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    logger.info("="*80)
    logger.info("Testing Model Manager")
    logger.info("="*80)

    # Create manager
    manager = ModelManager()

    # List versions
    logger.info(f"\nAvailable versions: {manager.list_versions()}")

    # Load v3.1
    logger.info("\n### Loading v3.1 ###")
    if manager.load_version('v3.1'):
        active = manager.get_active_version()
        logger.info(f"\n✅ Active version: {active.version}")
        logger.info(f"   Name: {active.name}")
        logger.info(f"   Description: {active.description}")
        logger.info(f"   Threshold: {active.threshold}")
        logger.info(f"   Stage 1: {'Loaded' if active.stage1_model else 'Not loaded'}")
        logger.info(f"   Stage 2: {'Loaded' if active.stage2_model else 'Not loaded'}")

    # Get versions info
    logger.info("\n### Versions Info ###")
    info = manager.get_versions_info()
    logger.info(json.dumps(info, indent=2))

    logger.info("\n" + "="*80)
    logger.info("✅ Model Manager test completed")
    logger.info("="*80)


if __name__ == '__main__':
    main()
