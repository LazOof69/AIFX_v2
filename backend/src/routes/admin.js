/**
 * Admin Routes
 * 獨立的管理員路由，不影響現有路由
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { adminAuth } = require('../middleware/adminAuth');

// 公開路由 (不需要認證)
router.post('/login', adminController.login);

// 受保護路由 (需要管理員認證)
router.use(adminAuth);

// 驗證 token
router.get('/verify', adminController.verify);

// 系統監控
router.get('/health', adminController.getSystemHealth);
router.get('/stats', adminController.getStats);

// 用戶管理
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);

// 訊號管理
router.get('/signals', adminController.getSignals);

// ML 管理
router.get('/ml/models', adminController.getMLModels);
router.get('/ml/status', adminController.getMLEngineStatus);
router.post('/ml/retrain/:modelId', adminController.retrainModel);

// 情緒分析
router.get('/sentiment/test/:pair', adminController.testSentiment);

module.exports = router;
