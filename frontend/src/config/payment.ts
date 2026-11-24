/**
 * Central Payment Configuration for SANJANA MOBILES
 * 
 * Configures shop UPI ID, merchant name, instructions, and verification modes.
 * Can be updated centrally here or overridden dynamically via Admin Dashboard Payment Settings.
 */

export interface PaymentConfig {
  upiId: string;
  merchantName: string;
  isUpiEnabled: boolean;
  requireManualVerification: boolean;
  qrCodeImageUrl?: string;
  paymentInstructions: string;
  instructions?: string;
}

export const paymentConfig: PaymentConfig = {
  // Configurable Shop UPI ID - Set to placeholder as instructed
  upiId: "REPLACE_WITH_REAL_SHOP_UPI_ID",
  merchantName: "SANJANA MOBILES",
  isUpiEnabled: true,
  requireManualVerification: true,
  qrCodeImageUrl: "",
  paymentInstructions: `1. Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app on your phone.
2. Or tap 'Pay with UPI' on supported Android mobile devices.
3. Complete the payment for the exact order amount shown.
4. Enter the 12-digit UPI Transaction Reference Number (UTR) in the verification box below.
5. Click 'Submit Payment for Verification' to confirm your order.`,
  instructions: `1. Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app on your phone.
2. Or tap 'Pay with UPI' on supported Android mobile devices.
3. Complete the payment for the exact order amount shown.
4. Enter the 12-digit UPI Transaction Reference Number (UTR) in the verification box below.
5. Click 'Submit Payment for Verification' to confirm your order.`
};

/**
 * Builds a compliant UPI intent / payment URI
 * 
 * Format:
 * upi://pay?pa=UPI_ID&pn=MERCHANT_NAME&am=ORDER_AMOUNT&cu=INR&tn=ORDER_REFERENCE
 */
export const buildUpiPaymentUri = (params: {
  upiId?: string;
  merchantName?: string;
  amount: number;
  orderNumber?: string;
  orderReference?: string;
}): string => {
  const upiId = params.upiId || paymentConfig.upiId;
  const merchantName = params.merchantName || paymentConfig.merchantName;
  const formattedAmount = params.amount.toFixed(2);
  const ref = params.orderNumber || params.orderReference || 'ORDER';
  const note = `Order ${ref} - SANJANA MOBILES`;

  const searchParams = new URLSearchParams({
    pa: upiId,
    pn: merchantName,
    am: formattedAmount,
    cu: 'INR',
    tn: note
  });

  return `upi://pay?${searchParams.toString()}`;
};
