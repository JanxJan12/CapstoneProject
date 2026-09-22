import {
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  Bike,
  FileText,
  IdCard,
  Loader2,
  Upload,
  UserRound,
} from "lucide-react";

import {
  submitRiderApplication,
  type SubmitRiderApplicationInput,
} from "../services/riderApplicationService";

interface Props {
  onSubmitted: () => void;
}

export function RiderApplicationPage({
  onSubmitted,
}: Props) {
  const [contactNumber, setContactNumber] =
    useState("");

  const [
    driverLicenseNumber,
    setDriverLicenseNumber,
  ] = useState("");

  const [plateNumber, setPlateNumber] =
    useState("");

  const [motorBrand, setMotorBrand] =
    useState("");

  const [motorModel, setMotorModel] =
    useState("");

  const [validId, setValidId] =
    useState<File | null>(null);

  const [orCrDocument, setOrCrDocument] =
    useState<File | null>(null);

  const [riderPhoto, setRiderPhoto] =
    useState<File | null>(null);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError(null);

    if (!validId) {
      setError("Please upload your valid ID.");
      return;
    }

    if (!orCrDocument) {
      setError(
        "Please upload your motorcycle OR/CR document.",
      );
      return;
    }

    if (!riderPhoto) {
      setError("Please upload your rider photo.");
      return;
    }

    const input: SubmitRiderApplicationInput = {
      contactNumber,
      driverLicenseNumber,
      plateNumber,
      motorBrand,
      motorModel,
      validId,
      orCrDocument,
      riderPhoto,
    };

    setSubmitting(true);

    try {
      await submitRiderApplication(input);

      onSubmitted();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit your rider application.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-shell">
      <div className="auth-form-card w-full max-w-[36rem] overflow-hidden rounded-xl">
        <div className="auth-panel-heading bg-[#211914] px-6 pb-6 pt-6 text-white sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-amber-300/80">
                Rider application
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Apply to become a rider
              </h1>

              <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/80">
                Provide your delivery and vehicle
                information. RRJ&apos;s Food-Haus
                management will review your application
                before rider access is granted.
              </p>
            </div>

            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
              <Bike className="h-5 w-5 text-amber-300" />
            </div>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="bg-card/90 p-6 sm:p-8"
        >
          {error ? (
            <ErrorBanner message={error} />
          ) : null}

          <section>
            <div className="mb-4">
              <h2 className="text-sm font-extrabold text-foreground">
                Contact & license information
              </h2>

              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Enter the information that management
                will use to verify your application.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Contact number"
                value={contactNumber}
                onChange={setContactNumber}
                placeholder="09XXXXXXXXX"
                autoComplete="tel"
                disabled={submitting}
              />

              <TextField
                label="Driver license number"
                value={driverLicenseNumber}
                onChange={setDriverLicenseNumber}
                placeholder="License number"
                disabled={submitting}
              />

              <TextField
                label="Plate number"
                value={plateNumber}
                onChange={setPlateNumber}
                placeholder="Plate number"
                disabled={submitting}
              />

              <TextField
                label="Motorcycle brand"
                value={motorBrand}
                onChange={setMotorBrand}
                placeholder="e.g. Honda"
                disabled={submitting}
              />

              <div className="sm:col-span-2">
                <TextField
                  label="Motorcycle model"
                  value={motorModel}
                  onChange={setMotorModel}
                  placeholder="e.g. Click 125i"
                  disabled={submitting}
                />
              </div>
            </div>
          </section>

          <div className="my-6 border-t border-border" />

          <section>
            <div className="mb-4">
              <h2 className="text-sm font-extrabold text-foreground">
                Required documents
              </h2>

              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Each file must be 5 MB or smaller.
                Documents may be JPG, PNG, or PDF.
                Your rider photo must be JPG or PNG.
              </p>
            </div>

            <div className="space-y-3">
              <FileUploadField
                label="Valid ID"
                description="Upload a clear copy of your valid identification."
                icon={IdCard}
                accept="image/jpeg,image/png,application/pdf"
                file={validId}
                onChange={setValidId}
                disabled={submitting}
              />

              <FileUploadField
                label="Motorcycle OR/CR"
                description="Upload the motorcycle registration document."
                icon={FileText}
                accept="image/jpeg,image/png,application/pdf"
                file={orCrDocument}
                onChange={setOrCrDocument}
                disabled={submitting}
              />

              <FileUploadField
                label="Rider photo"
                description="Upload a clear recent photo of yourself."
                icon={UserRound}
                accept="image/jpeg,image/png"
                file={riderPhoto}
                onChange={setRiderPhoto}
                disabled={submitting}
              />
            </div>
          </section>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <p className="text-xs font-bold text-amber-900">
              Management approval required
            </p>

            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Submitting this form does not immediately
              give you Rider access. Your application
              will remain pending until it is reviewed
              and approved by RRJ&apos;s Food-Haus
              management.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="mt-6 flex min-h-[3.15rem] w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting application…
              </>
            ) : (
              <>
                <Bike className="h-4 w-4" />
                Submit rider application
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
}: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-foreground">
        {label}
        <span
          className="ml-1 text-primary"
          aria-hidden="true"
        >
          *
        </span>
      </span>

      <input
        type="text"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        required
        maxLength={100}
        className="min-h-[2.9rem] w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

interface FileUploadFieldProps {
  label: string;
  description: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  icon: React.ElementType;
}

function FileUploadField({
  label,
  description,
  accept,
  file,
  onChange,
  disabled,
  icon: Icon,
}: FileUploadFieldProps) {
  return (
    <label className="block cursor-pointer">
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
        }}
        className="sr-only"
      />

      <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 transition hover:border-primary/30 hover:bg-muted/30">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">
            {label}
            <span
              className="ml-1 text-primary"
              aria-hidden="true"
            >
              *
            </span>
          </p>

          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {file ? file.name : description}
          </p>
        </div>

        <div className="flex flex-none items-center gap-1.5 text-xs font-bold text-primary">
          <Upload className="h-3.5 w-3.5" />
          {file ? "Change" : "Upload"}
        </div>
      </div>
    </label>
  );
}

function ErrorBanner({
  message,
}: {
  message: string;
}) {
  return (
    <div
      className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3"
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-red-600" />

      <p className="text-sm font-semibold leading-relaxed text-red-800">
        {message}
      </p>
    </div>
  );
}