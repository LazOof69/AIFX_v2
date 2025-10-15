#!/usr/bin/env python3
"""
Retrain Stage 1 Reversal Detector with Profitable Labels

使用新的基於獲利潛力的標籤重訓練Stage 1模型

關鍵改進：
- 樣本數: 68 → 1080 (15倍增長)
- 類別平衡: 3.26% → 51.82% (接近50:50)
- 標籤質量: 基於實際可獲利交易機會

預期：大幅提升Recall (22% → 60%+)

Author: AI-assisted
Created: 2025-10-15
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np
from datetime import datetime
import logging
import json
import pickle

from tensorflow import keras
from tensorflow.keras import layers, models, regularizers
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ProfitableReversalTrainer:
    """使用新標籤訓練反轉檢測模型"""

    def __init__(self, data_dir: Path, models_dir: Path):
        self.data_dir = Path(data_dir)
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(exist_ok=True, parents=True)

        self.sequence_length = 20
        self.batch_size = 32
        self.epochs = 100
        self.patience = 15

        logger.info(f"Data directory: {self.data_dir}")
        logger.info(f"Models directory: {self.models_dir}")

    def load_data(self):
        """加載新標籤的訓練數據"""
        logger.info("="*80)
        logger.info("Loading Training Data (Profitable Labels)")
        logger.info("="*80)

        # 加載訓練集
        train_features = pd.read_csv(
            self.data_dir / 'EURUSD_profitable_train_features.csv',
            index_col=0,
            parse_dates=True
        )
        train_labels = pd.read_csv(
            self.data_dir / 'EURUSD_profitable_train_labels.csv'
        )

        logger.info(f"Train features: {train_features.shape}")
        logger.info(f"Train labels: {train_labels.shape}")

        # 加載驗證集
        val_features = pd.read_csv(
            self.data_dir / 'EURUSD_profitable_val_features.csv',
            index_col=0,
            parse_dates=True
        )
        val_labels = pd.read_csv(
            self.data_dir / 'EURUSD_profitable_val_labels.csv'
        )

        logger.info(f"Val features: {val_features.shape}")
        logger.info(f"Val labels: {val_labels.shape}")

        # 只使用12個核心特徵（與之前模型一致）
        selected_features = [
            'sma_20', 'sma_50', 'ema_12', 'ema_26',
            'rsi_14', 'macd', 'macd_signal', 'macd_histogram',
            'bb_width', 'atr_14', 'stoch_k', 'adx_14'
        ]

        train_features = train_features[selected_features]
        val_features = val_features[selected_features]

        logger.info(f"Using {len(selected_features)} selected features")

        # 保存特徵列表
        features_config = {
            'features': selected_features,
            'num_features': len(selected_features),
            'description': '12 core technical indicators'
        }

        features_file = self.models_dir / 'profitable_selected_features.json'
        with open(features_file, 'w') as f:
            json.dump(features_config, f, indent=2)
        logger.info(f"✅ Saved feature config to {features_file}")

        return train_features, train_labels, val_features, val_labels, selected_features

    def normalize_features(self, train_features, val_features):
        """歸一化特徵"""
        logger.info("\nNormalizing features...")

        scaler = StandardScaler()
        train_scaled = scaler.fit_transform(train_features)
        val_scaled = scaler.transform(val_features)

        # 保存scaler
        scaler_file = self.models_dir / 'profitable_feature_scaler.pkl'
        with open(scaler_file, 'wb') as f:
            pickle.dump(scaler, f)
        logger.info(f"✅ Saved scaler to {scaler_file}")

        # 轉回DataFrame
        train_features_scaled = pd.DataFrame(
            train_scaled,
            columns=train_features.columns,
            index=train_features.index
        )
        val_features_scaled = pd.DataFrame(
            val_scaled,
            columns=val_features.columns,
            index=val_features.index
        )

        return train_features_scaled, val_features_scaled, scaler

    def create_sequences(self, features, labels):
        """創建時間序列"""
        X = []
        y = []

        for i in range(self.sequence_length, len(features)):
            sequence = features.iloc[i-self.sequence_length:i].values
            X.append(sequence)

            # Stage 1: binary classification (has reversal or not)
            label = labels.iloc[i]['signal']
            y.append(1 if label > 0 else 0)

        X = np.array(X)
        y = np.array(y)

        return X, y

    def calculate_class_weights(self, y):
        """計算類別權重"""
        logger.info("\nCalculating class weights...")

        class_weights = compute_class_weight(
            class_weight='balanced',
            classes=np.array([0, 1]),
            y=y
        )

        class_weight_dict = {
            0: class_weights[0],
            1: class_weights[1]
        }

        logger.info(f"Class weights: {class_weight_dict}")
        logger.info(f"  No reversal (0): {class_weight_dict[0]:.3f}")
        logger.info(f"  Has reversal (1): {class_weight_dict[1]:.3f}")

        return class_weight_dict

    def build_model(self, num_features):
        """構建Stage 1模型"""
        logger.info("\n" + "="*80)
        logger.info("Building Model Architecture")
        logger.info("="*80)

        inputs = layers.Input(
            shape=(self.sequence_length, num_features),
            name='market_data'
        )

        # LSTM層
        x = layers.LSTM(
            64,
            return_sequences=True,
            kernel_regularizer=regularizers.l2(0.0001),
            name='lstm_1'
        )(inputs)
        x = layers.Dropout(0.2, name='dropout_1')(x)

        x = layers.LSTM(
            32,
            return_sequences=False,
            kernel_regularizer=regularizers.l2(0.0001),
            name='lstm_2'
        )(x)
        x = layers.Dropout(0.2, name='dropout_2')(x)

        # Dense層
        x = layers.Dense(
            32,
            activation='relu',
            kernel_regularizer=regularizers.l2(0.0001),
            name='dense_1'
        )(x)
        x = layers.Dropout(0.1, name='dropout_3')(x)

        x = layers.Dense(
            16,
            activation='relu',
            kernel_regularizer=regularizers.l2(0.0001),
            name='dense_2'
        )(x)

        # 輸出層: binary classification
        output = layers.Dense(
            1,
            activation='sigmoid',
            name='has_reversal'
        )(x)

        model = models.Model(inputs=inputs, outputs=output, name='ProfitableReversalDetector')

        logger.info(f"Model architecture:")
        model.summary(print_fn=lambda x: logger.info(x))

        return model

    def compile_model(self, model):
        """編譯模型"""
        logger.info("\nCompiling model...")

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='binary_crossentropy',
            metrics=[
                keras.metrics.BinaryAccuracy(name='accuracy'),
                keras.metrics.Precision(name='precision'),
                keras.metrics.Recall(name='recall'),
                keras.metrics.AUC(name='auc')
            ]
        )

        logger.info("✅ Model compiled with Binary Crossentropy")

        return model

    def get_callbacks(self):
        """獲取訓練回調"""
        checkpoint_dir = self.models_dir / 'checkpoints'
        checkpoint_dir.mkdir(exist_ok=True)

        return [
            EarlyStopping(
                monitor='val_loss',
                patience=self.patience,
                restore_best_weights=True,
                verbose=1
            ),
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=self.patience // 2,
                min_lr=1e-6,
                verbose=1
            ),
            ModelCheckpoint(
                str(checkpoint_dir / 'profitable_stage1_best.h5'),
                monitor='val_recall',  # 優化Recall
                mode='max',
                save_best_only=True,
                verbose=1
            )
        ]

    def train(self):
        """完整訓練流程"""
        logger.info("\n" + "="*80)
        logger.info("TRAINING STAGE 1 WITH PROFITABLE LABELS")
        logger.info("="*80)

        # 1. 加載數據
        train_features, train_labels, val_features, val_labels, selected_features = self.load_data()

        # 2. 歸一化
        train_features_scaled, val_features_scaled, scaler = self.normalize_features(
            train_features, val_features
        )

        # 3. 創建序列
        logger.info("\nCreating sequences...")
        X_train, y_train = self.create_sequences(train_features_scaled, train_labels)
        X_val, y_val = self.create_sequences(val_features_scaled, val_labels)

        logger.info(f"Training sequences: {X_train.shape}")
        logger.info(f"  Has reversal: {np.sum(y_train)} ({100*np.mean(y_train):.2f}%)")
        logger.info(f"  No reversal: {len(y_train) - np.sum(y_train)} ({100*(1-np.mean(y_train)):.2f}%)")

        logger.info(f"Validation sequences: {X_val.shape}")
        logger.info(f"  Has reversal: {np.sum(y_val)} ({100*np.mean(y_val):.2f}%)")

        # 4. 計算類別權重
        class_weights = self.calculate_class_weights(y_train)

        # 5. 構建模型
        model = self.build_model(num_features=len(selected_features))
        model = self.compile_model(model)

        # 6. 訓練
        logger.info("\n" + "="*80)
        logger.info("Starting Training")
        logger.info("="*80)

        history = model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=self.epochs,
            batch_size=self.batch_size,
            class_weight=class_weights,
            callbacks=self.get_callbacks(),
            verbose=1
        )

        # 7. 保存模型
        model_file = self.models_dir / 'profitable_reversal_detector_stage1.h5'
        model.save(model_file)
        logger.info(f"\n✅ Model saved to {model_file}")

        # 8. 保存訓練歷史
        history_file = self.models_dir / 'profitable_training_history.json'
        history_dict = {k: [float(v) for v in vals] for k, vals in history.history.items()}
        with open(history_file, 'w') as f:
            json.dump(history_dict, f, indent=2)
        logger.info(f"✅ Training history saved to {history_file}")

        # 9. 保存元數據
        metadata = {
            'model_name': 'profitable_reversal_detector_stage1',
            'version': '3.1-profitable',
            'training_date': datetime.now().isoformat(),
            'architecture': {
                'sequence_length': self.sequence_length,
                'num_features': len(selected_features),
                'lstm_units': [64, 32],
                'dense_units': [32, 16],
                'dropout': [0.2, 0.2, 0.1],
                'l2_reg': 0.0001
            },
            'training_config': {
                'optimizer': 'Adam',
                'learning_rate': 0.001,
                'loss': 'binary_crossentropy',
                'batch_size': self.batch_size,
                'epochs': self.epochs,
                'patience': self.patience
            },
            'data_stats': {
                'train_samples': len(X_train),
                'val_samples': len(X_val),
                'train_reversal_pct': float(np.mean(y_train)),
                'val_reversal_pct': float(np.mean(y_val))
            },
            'class_weights': class_weights,
            'final_metrics': {
                'val_loss': float(history.history['val_loss'][-1]),
                'val_accuracy': float(history.history['val_accuracy'][-1]),
                'val_precision': float(history.history['val_precision'][-1]),
                'val_recall': float(history.history['val_recall'][-1]),
                'val_auc': float(history.history['val_auc'][-1])
            }
        }

        metadata_file = self.models_dir / 'profitable_stage1_metadata.json'
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"✅ Metadata saved to {metadata_file}")

        # 10. 打印最終結果
        logger.info("\n" + "="*80)
        logger.info("TRAINING COMPLETE")
        logger.info("="*80)

        logger.info(f"\nFinal Validation Metrics:")
        logger.info(f"  Loss:      {metadata['final_metrics']['val_loss']:.4f}")
        logger.info(f"  Accuracy:  {metadata['final_metrics']['val_accuracy']:.4f}")
        logger.info(f"  Precision: {metadata['final_metrics']['val_precision']:.4f}")
        logger.info(f"  Recall:    {metadata['final_metrics']['val_recall']:.4f}")
        logger.info(f"  AUC:       {metadata['final_metrics']['val_auc']:.4f}")

        return model, history


def main():
    """主執行"""
    data_dir = Path(__file__).parent.parent / 'data' / 'training_v3_profitable'
    models_dir = Path(__file__).parent.parent / 'models' / 'trained'

    trainer = ProfitableReversalTrainer(data_dir, models_dir)
    model, history = trainer.train()


if __name__ == '__main__':
    main()
