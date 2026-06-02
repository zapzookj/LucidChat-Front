import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from '../api/axios';
import { sfx } from '../utils/sfx';

/**
 * Phase 5: Payment Modal (Energy Shop + Packages)
 *
 * Flow:
 * 1. User selects product
 * 2. POST /api/v1/payments/ready -> get merchantUid
 * 3. PortOne SDK payment popup
 * 4. POST /api/v1/payments/confirm -> server-side verification
 * 5. Success -> energy charged / package activated
 *
 * [Phase 7-V2 / Chunk C-3] `initialTab` prop 추가 (additive):
 *   - V1 caller는 미전달 → 'energy' 기본 (기존 동작 유지)
 *   - V2 caller (ChatPageV2의 secret-store 진입)는 'packages' 전달 → 시크릿 상품 즉시 노출
 *   - isOpen 변경 시 마다 initialTab 값으로 재동기화 — 매번 깔끔한 시작 보장
 */

const PRODUCTS = {
  energy: [
    { type: 'ENERGY_T1', name: 'Coffee', price: 1500, energy: 30, emoji: '\u2615' },
    { type: 'ENERGY_T2', name: 'Dessert Set', price: 4500, energy: 100, emoji: '\uD83C\uDF70' },
    { type: 'ENERGY_T3', name: 'Afternoon Tea', price: 9900, energy: 250, emoji: '\uD83C\uDF75', bonus: '+Affection Potion' },
  ],
  packages: [
    { type: 'SECRET_PASS_24H', name: 'Secret Night Pass', price: 2900, desc: '24h Secret Mode', emoji: '\uD83C\uDF19' },
    { type: 'SECRET_UNLOCK_PERMANENT', name: 'Secret Unlock Key', price: 14900, desc: 'Permanent unlock', emoji: '\uD83D\uDD11' },
    { type: 'LUCID_PASS_MONTHLY', name: 'Lucid Pass', price: 19900, desc: 'Monthly premium', emoji: '\u2B50' },
  ],
};

const PaymentModal = ({ isOpen, onClose, onPaymentComplete, userEnergy, initialTab = 'energy' }) => {
  const [tab, setTab] = useState(initialTab);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | processing | success | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      sfx.wooshLight();
      // [Chunk C-3] 매번 열릴 때 initialTab으로 재동기화
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (status === 'error') sfx.thud();
  }, [status]);

  const handlePurchase = useCallback(async (product) => {
    setSelectedProduct(product);
    setStatus('processing');
    setErrorMsg('');

    try {
      // Step 1: Create order on server
      const prepareRes = await axios.post('/api/v1/payments/ready', {
        productType: product.type,
        targetCharacterId: product.targetCharacterId || null,
      });

      const { merchantUid, productName, amount } = prepareRes.data;

      // Step 2: PortOne SDK payment
      if (!window.IMP) {
        throw new Error('PortOne SDK not loaded');
      }

      window.IMP.init('imp_YOUR_CODE'); // Replace with actual PortOne merchant code

      window.IMP.request_pay(
        {
          pg: 'tosspayments',
          pay_method: 'card',
          merchant_uid: merchantUid,
          name: productName,
          amount: amount,
          buyer_name: 'Lucid User',
        },
        async (response) => {
          if (response.success) {
            try {
              // Step 3: Server-side verification
              const confirmRes = await axios.post('/api/v1/payments/confirm', {
                impUid: response.imp_uid,
                merchantUid: merchantUid,
              });

              if (confirmRes.data.status === 'PAID') {
                setStatus('success');
                setTimeout(() => {
                  onPaymentComplete && onPaymentComplete(confirmRes.data);
                  setStatus('idle');
                  setSelectedProduct(null);
                }, 2000);
              } else {
                setStatus('error');
                setErrorMsg(confirmRes.data.message || 'Payment verification failed');
              }
            } catch (err) {
              setStatus('error');
              setErrorMsg(err.response?.data?.message || 'Server verification failed');
            }
          } else {
            setStatus('error');
            setErrorMsg(response.error_msg || 'Payment cancelled');
          }
        }
      );
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.message || err.message || 'Payment failed');
    }
  }, [onPaymentComplete]);

  if (!isOpen) return null;

  const formatPrice = (price) => price.toLocaleString() + 'won';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative z-10 w-[90vw] max-w-lg rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
          style={{
            background: 'linear-gradient(135deg, rgba(20,15,40,0.97), rgba(40,25,70,0.95))',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          }}
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Energy Shop</h2>
            <button onClick={() => { sfx.click(); onClose?.(); }} className="text-white/50 hover:text-white text-2xl">&times;</button>
          </div>

          {/* Current Energy */}
          <div className="bg-white/5 rounded-xl p-3 mb-4 text-center">
            <span className="text-white/60 text-sm">Current Energy: </span>
            <span className="text-purple-300 font-bold text-lg">{userEnergy || 0}</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {['energy', 'packages'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                  tab === t ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {t === 'energy' ? 'Energy' : 'Packages'}
              </button>
            ))}
          </div>

          {/* Status overlay */}
          {status === 'processing' && (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-white/70">Processing payment...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">&#x2705;</div>
              <p className="text-white font-bold">Payment Complete!</p>
              <p className="text-purple-300 text-sm mt-1">
                {selectedProduct?.energy ? `+${selectedProduct.energy} Energy` : selectedProduct?.desc}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-4 mb-4">
              <p className="text-red-400 text-sm">{errorMsg}</p>
              <button onClick={() => { setStatus('idle'); setErrorMsg(''); }}
                className="mt-2 text-purple-300 text-sm underline">Dismiss</button>
            </div>
          )}

          {/* Product list */}
          {status === 'idle' && (
            <div className="space-y-3">
              {(tab === 'energy' ? PRODUCTS.energy : PRODUCTS.packages).map((product) => (
                <motion.div
                  key={product.type}
                  className="bg-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { sfx.click(); handlePurchase(product); }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{product.emoji}</span>
                    <div>
                      <p className="text-white font-medium">{product.name}</p>
                      <p className="text-white/50 text-xs">
                        {product.energy ? `${product.energy} Energy` : product.desc}
                        {product.bonus && <span className="text-purple-300 ml-1">{product.bonus}</span>}
                      </p>
                    </div>
                  </div>
                  <span className="text-purple-300 font-bold text-sm">{formatPrice(product.price)}</span>
                </motion.div>
              ))}
            </div>
          )}

          {/* Footer info */}
          <p className="text-white/30 text-xs text-center mt-4">
            Free energy recovers +1 every 10min (max 30). Paid energy has no cap.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PaymentModal;