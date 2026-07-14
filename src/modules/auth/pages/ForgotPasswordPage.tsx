import { Mail, ArrowLeft, CheckCircle, UtensilsCrossed } from "lucide-react";
import { InputField } from "../../../components/common/Input";

export function ForgotPasswordPage() {
  return (
    <div className="min-h-full bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-red-400" />
        <div className="p-8">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <UtensilsCrossed className="text-white w-4 h-4" strokeWidth={2.5} />
            </div>
            <div className="font-bold text-base text-foreground leading-none">RRJ Food-House</div>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-1">Forgot Password</h1>
          <p className="text-sm text-muted-foreground mb-5">Enter your staff email to receive a password reset link.</p>
          <div className="mb-5">
            <InputField label="Email Address" type="email" placeholder="staff@rrjfoodhouse.com" value="" onChange={() => {}} icon={Mail} />
          </div>
          <button style={{ minHeight: 44 }} className="w-full flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-amber-800 shadow-sm mb-3">Send Reset Link</button>
          <button className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />Return to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export function ForgotPasswordSuccessPage() {
  return (
    <div className="min-h-full bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-red-400" />
        <div className="p-8">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <UtensilsCrossed className="text-white w-4 h-4" strokeWidth={2.5} />
            </div>
            <div className="font-bold text-base text-foreground leading-none">RRJ Food-House</div>
          </div>
          <div className="flex flex-col items-center text-center py-2">
            <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-5">
              <CheckCircle className="w-7 h-7 text-green-500" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Password Reset Email Sent</h2>
            <p className="text-sm text-muted-foreground mb-6">If the email exists in our records, a password reset link has been sent.</p>
            <button style={{ minHeight: 44 }} className="w-full flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-amber-800 shadow-sm">Return to Login</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ForgotPasswordMobilePage() {
  return (
    <div className="flex-1 bg-background px-5 pt-5 pb-5">
      <div className="mb-5 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <UtensilsCrossed className="text-white w-3.5 h-3.5" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-sm text-foreground">RRJ Food-House</span>
      </div>
      <h1 className="text-lg font-bold text-foreground mb-1">Forgot Password</h1>
      <p className="text-xs text-muted-foreground mb-5">Enter your email to receive a password reset link.</p>
      <div className="mb-5">
        <InputField label="Email Address" type="email" placeholder="staff@rrjfoodhouse.com" value="" onChange={() => {}} icon={Mail} />
      </div>
      <button style={{ minHeight: 44 }} className="w-full flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm mb-2">Send Reset Link</button>
      <button className="w-full flex items-center justify-center gap-1 py-2 text-xs font-semibold text-muted-foreground">
        <ArrowLeft className="w-3.5 h-3.5" />Return to Login
      </button>
    </div>
  );
}
