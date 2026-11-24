import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Printer,
  Download,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  ShieldCheck,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Invoice } from '../../types';
import { formatPrice } from '../../config/store';
import { Button } from '../../components/common/Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const InvoicePage: React.FC = () => {
  const { orderIdOrNumber } = useParams<{ orderIdOrNumber: string }>();
  const navigate = useNavigate();
  const { token, role } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!orderIdOrNumber) return;
      setLoading(true);
      setError(null);
      const activeToken = token || (role === 'admin' ? 'mock-admin-token' : 'mock-customer-token');
      try {
        let data: Invoice;
        if (role === 'admin') {
          data = await api.getAdminOrderInvoice(activeToken, orderIdOrNumber);
        } else {
          data = await api.getOrderInvoice(activeToken, orderIdOrNumber);
        }
        setInvoice(data);
      } catch (err: any) {
        console.error('Failed to load invoice:', err);
        setError(err.message || 'Unable to load invoice. Please verify your permissions and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [orderIdOrNumber, token, role]);

  // Handle native browser print
  const handlePrint = () => {
    window.print();
  };

  // Handle high quality PDF download
  const handleDownloadPdf = async () => {
    if (!invoiceRef.current || !invoice) return;
    setIsPdfGenerating(true);
    try {
      // Temporarily ensure background is white for rendering
      const element = invoiceRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // High resolution for crisp printing
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeNumber = invoice.invoice_number.replace(/\//g, '_');
      pdf.save(`Sanjana_Mobiles_Invoice_${safeNumber}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Could not generate PDF. Please use the Print option and choose Save as PDF.');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-3 border-plum-200 border-t-coral-500 rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-base font-bold text-plum-950 font-display">Generating Showroom Tax Invoice...</h2>
        <p className="text-xs text-plum-500 mt-1">Retrieving official order records, store details, and verification data.</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-red-200 p-8 shadow-card text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold font-display text-plum-950">Invoice Access Notice</h2>
          <p className="text-xs sm:text-sm text-plum-600 leading-relaxed">
            {error || 'The requested invoice could not be located.'}
          </p>
          <div className="pt-2">
            <Button
              variant="outline"
              size="md"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate(role === 'admin' ? '/admin/orders' : '/orders')}
            >
              {role === 'admin' ? 'Back to Admin Orders' : 'Back to My Orders'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { store_info, customer_info, payment_info, pricing, items } = invoice;

  return (
    <div className="min-h-screen bg-slate-100/70 py-8 px-4 sm:px-6 lg:px-8 print:p-0 print:bg-white">
      {/* Top Action Bar (Hidden during Print) */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <button
          type="button"
          onClick={() => navigate(role === 'admin' ? '/admin/orders' : '/orders')}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-plum-700 bg-white hover:bg-plum-50 border border-plum-200 rounded-xl transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{role === 'admin' ? 'Back to Admin Orders' : 'Back to My Orders'}</span>
        </button>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleDownloadPdf}
            isLoading={isPdfGenerating}
            disabled={isPdfGenerating}
          >
            {isPdfGenerating ? 'Generating PDF...' : 'Download PDF'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Print Invoice
          </Button>
        </div>
      </div>

      {/* Printable Invoice Container */}
      <div
        ref={invoiceRef}
        id="invoice-printable-card"
        className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-12 print:p-0 print:border-none print:shadow-none print:rounded-none text-slate-900 font-sans"
        style={{ minHeight: '297mm' }}
      >
        {/* ======================================================== */}
        {/* 1. SHOWROOM HEADER & BRAND SECTION */}
        {/* ======================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-800">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <img
                src="/images/sanjana-mobiles-logo.png"
                alt="SANJANA MOBILES"
                className="h-12 w-auto object-contain"
                onError={(e) => {
                  // Fallback to SVG if PNG fails
                  (e.target as HTMLElement).setAttribute('src', '/images/sanjana-mobiles-logo.svg');
                }}
              />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 uppercase font-display leading-tight">
                  {store_info.store_name}
                </h1>
                <p className="text-[11px] font-semibold text-coral-600 uppercase tracking-widest">
                  {store_info.tagline || 'Original Smartphones & Genuine Accessories'}
                </p>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 leading-relaxed max-w-sm pt-1">
              <p className="font-medium">
                {store_info.address_line1}
                {store_info.address_line2 ? `, ${store_info.address_line2}` : ''}
              </p>
              <p>
                {store_info.city}{store_info.district ? `, ${store_info.district}` : ''}, {store_info.state} - {store_info.postal_code}, {store_info.country}
              </p>
              <p className="flex items-center gap-3 pt-0.5 font-medium text-slate-700">
                <span>Phone: +91 {store_info.phone}</span>
                {store_info.email && <span>• Email: {store_info.email}</span>}
              </p>
              {store_info.gstin && (
                <p className="font-bold text-slate-900 pt-0.5">
                  GSTIN: <span className="font-mono text-xs">{store_info.gstin}</span>
                </p>
              )}
            </div>
          </div>

          <div className="text-left sm:text-right space-y-1.5 shrink-0">
            <div className="inline-block bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded">
              Retail Tax Invoice
            </div>
            <div className="pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Invoice Number
              </span>
              <span className="text-base font-extrabold font-mono text-slate-950">
                {invoice.invoice_number}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Order Reference
              </span>
              <span className="text-xs font-bold font-mono text-coral-600">
                {invoice.order_number}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Invoice Date
              </span>
              <span className="text-xs font-semibold text-slate-700">
                {new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. CUSTOMER & ORDER METADATA */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200 text-xs">
          {/* Customer Billed / Shipped To */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Billed & Shipped To:
            </span>
            <p className="text-sm font-bold text-slate-950">{customer_info.full_name}</p>
            {customer_info.mobile && (
              <p className="text-slate-700">
                <span className="text-slate-400">Mobile:</span> +91 {customer_info.mobile}
              </p>
            )}
            {customer_info.email && (
              <p className="text-slate-700">
                <span className="text-slate-400">Email:</span> {customer_info.email}
              </p>
            )}
            {customer_info.shipping_address ? (
              <div className="text-slate-600 pt-1 leading-relaxed">
                <p>
                  {customer_info.shipping_address.address_line1}
                  {customer_info.shipping_address.address_line2 ? `, ${customer_info.shipping_address.address_line2}` : ''}
                </p>
                <p>
                  {customer_info.shipping_address.city}
                  {customer_info.shipping_address.district ? `, ${customer_info.shipping_address.district}` : ''},{' '}
                  {customer_info.shipping_address.state} - {customer_info.shipping_address.pin_code || customer_info.shipping_address.postal_code}
                </p>
              </div>
            ) : (
              <p className="text-slate-500 italic pt-1">
                {customer_info.delivery_method === 'STORE_PICKUP'
                  ? 'Store Pickup Counter (Physical Handover)'
                  : 'Customer Address on Record'}
              </p>
            )}
          </div>

          {/* Delivery & Fulfillment Summary */}
          <div className="sm:text-right space-y-1 sm:pl-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Fulfillment & Order Status:
            </span>
            <div>
              <span className="text-slate-500">Delivery Channel: </span>
              <strong className="text-slate-900">
                {customer_info.delivery_method === 'STORE_PICKUP'
                  ? 'Store Counter Pickup'
                  : 'Doorstep Courier / Concierge Delivery'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Order Placed Date: </span>
              <span className="text-slate-800 font-medium">
                {new Date(invoice.order_date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div className="pt-1">
              <span className="text-slate-500 block text-[10px] uppercase font-bold sm:inline sm:mr-2">
                Order Status:
              </span>
              <span className={`inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded ${
                invoice.order_status === 'DELIVERED' || invoice.order_status === 'COMPLETED'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : invoice.order_status === 'REJECTED' || invoice.order_status === 'CANCELLED'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {invoice.display_order_status}
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. PRODUCT PURCHASE TABLE */}
        {/* ======================================================== */}
        <div className="py-6">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-50 text-slate-800 uppercase font-bold text-[10px] tracking-wider">
                <th className="py-3 px-2 w-12 text-center">S.No</th>
                <th className="py-3 px-3">Product Description</th>
                <th className="py-3 px-3">Model / Variant</th>
                <th className="py-3 px-3 text-center w-16">Qty</th>
                <th className="py-3 px-3 text-right">Unit Price</th>
                <th className="py-3 px-3 text-right">Discount</th>
                <th className="py-3 px-3 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((it) => (
                <tr key={it.s_no} className="hover:bg-slate-50/50">
                  <td className="py-3 px-2 text-center font-mono text-slate-500 font-semibold">
                    {it.s_no}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    <p className="leading-snug">{it.product_name}</p>
                    <span className="text-[10px] font-mono text-slate-400 font-normal">
                      SKU: {it.sku}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-medium">
                    {it.variant || it.model || 'Standard Edition'}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-slate-900">
                    {it.quantity}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-slate-700">
                    {formatPrice(it.unit_price)}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-600 font-medium">
                    {it.discount > 0 ? `-${formatPrice(it.discount)}` : '₹0.00'}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-950 font-mono">
                    {formatPrice(it.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ======================================================== */}
        {/* 4. FINANCIAL SUMMARY & TAX BREAKDOWN */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 pb-6 border-t-2 border-slate-900">
          {/* Left Column: Payment & GST Breakdown Note */}
          <div className="space-y-4 text-xs">
            {/* Payment Section */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Payment Details
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  payment_info.payment_status === 'PAID' || payment_info.payment_status === 'VERIFIED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : payment_info.payment_status === 'VERIFICATION_PENDING'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {payment_info.payment_status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Method</span>
                  <span className="font-semibold text-slate-900">{payment_info.payment_method}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Reference / UTR</span>
                  <span className="font-mono font-bold text-slate-900">
                    {payment_info.transaction_id || payment_info.payment_reference || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Amount Paid</span>
                  <span className="font-bold text-emerald-700">{formatPrice(payment_info.amount_paid)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Balance Due</span>
                  <span className={`font-bold ${payment_info.balance_due > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                    {formatPrice(payment_info.balance_due)}
                  </span>
                </div>
              </div>
            </div>

            {/* Amount in words */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Amount in Words:
              </span>
              <p className="text-xs font-bold text-slate-900 italic">
                {pricing.total_in_words}
              </p>
            </div>

            {/* GST Tax Note */}
            <p className="text-[10px] text-slate-500 leading-normal italic">
              * Note: Product prices are inclusive of Goods and Services Tax (GST 18%).
              {pricing.cgst > 0 && ` Tax breakdown: CGST (9%) ₹${pricing.cgst.toFixed(2)} + SGST (9%) ₹${pricing.sgst.toFixed(2)}.`}
              {pricing.igst > 0 && ` Integrated Tax: IGST (18%) ₹${pricing.igst.toFixed(2)}.`}
            </p>
          </div>

          {/* Right Column: Pricing Calculations Table */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 text-slate-600">
              <span>Item Subtotal:</span>
              <span className="font-semibold text-slate-900">{formatPrice(pricing.subtotal)}</span>
            </div>
            {pricing.product_discount > 0 && (
              <div className="flex justify-between py-1 text-emerald-700">
                <span>Discounts Applied:</span>
                <span className="font-semibold">-{formatPrice(pricing.product_discount)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 text-slate-600">
              <span>Delivery / Shipping Charges:</span>
              <span className="font-semibold text-slate-900">
                {pricing.delivery_charge > 0 ? formatPrice(pricing.delivery_charge) : 'FREE'}
              </span>
            </div>
            <div className="flex justify-between py-1 text-slate-500 border-t border-slate-200 pt-2">
              <span>Taxable Value (Before Tax):</span>
              <span className="font-mono">{formatPrice(pricing.taxable_amount)}</span>
            </div>
            {pricing.cgst > 0 && (
              <div className="flex justify-between py-0.5 text-slate-500">
                <span>Central GST (CGST 9%):</span>
                <span className="font-mono">{formatPrice(pricing.cgst)}</span>
              </div>
            )}
            {pricing.sgst > 0 && (
              <div className="flex justify-between py-0.5 text-slate-500">
                <span>State GST (SGST 9%):</span>
                <span className="font-mono">{formatPrice(pricing.sgst)}</span>
              </div>
            )}
            {pricing.igst > 0 && (
              <div className="flex justify-between py-0.5 text-slate-500">
                <span>Integrated GST (IGST 18%):</span>
                <span className="font-mono">{formatPrice(pricing.igst)}</span>
              </div>
            )}

            <div className="flex justify-between py-3 border-t-2 border-b-2 border-slate-900 text-sm font-extrabold text-slate-950 mt-2">
              <span>GRAND TOTAL:</span>
              <span className="text-base font-mono font-black text-slate-950">
                {formatPrice(pricing.grand_total)}
              </span>
            </div>

            <div className="flex justify-between py-1 text-xs">
              <span className="text-slate-600">Amount Paid:</span>
              <span className="font-bold text-emerald-700 font-mono">
                {formatPrice(pricing.amount_paid)}
              </span>
            </div>
            {pricing.balance_due > 0 && (
              <div className="flex justify-between py-1 text-xs text-amber-800 bg-amber-50 px-2 rounded">
                <span className="font-semibold">Balance Due at Handover:</span>
                <span className="font-bold font-mono">{formatPrice(pricing.balance_due)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 5. SHOWROOM TERMS & SIGNATURE FOOTER */}
        {/* ======================================================== */}
        <div className="pt-8 mt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-8 text-[11px] text-slate-500">
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-slate-700 block text-[10px]">
              Terms & Conditions:
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-[10px] leading-relaxed">
              <li>All mobile handsets and accessories carry genuine manufacturer warranty.</li>
              <li>Please retain this invoice and product box for warranty and authorized service.</li>
              <li>Goods once sold can only be replaced or serviced in accordance with showroom policy.</li>
              <li>This is a computer-generated tax invoice issued by SANJANA MOBILES.</li>
            </ul>
          </div>

          <div className="flex flex-col items-start sm:items-end justify-between space-y-8">
            <div className="text-center sm:text-right">
              <p className="text-[10px] font-bold text-slate-800 uppercase tracking-wider mb-8">
                For SANJANA MOBILES
              </p>
              <div className="w-48 border-b border-slate-400 pb-1 text-center">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">
                  Authorized Signatory
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
