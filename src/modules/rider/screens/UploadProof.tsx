import { ArrowLeft, Camera, ImageIcon, Upload } from "lucide-react";

export function UploadProof() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 py-4 flex items-center gap-2.5 flex-shrink-0">
        <ArrowLeft className="w-4 h-4 text-white" />
        <p className="text-white font-bold text-sm">Proof of Delivery</p>
      </div>
      <div className="flex-1 bg-background px-4 py-4 overflow-y-auto">
        <p className="text-xs font-bold mb-1">Upload Delivery Photo</p>
        <p className="text-[9px] text-muted-foreground mb-4">Take a photo as proof that the order was delivered.</p>
        <div className="h-40 bg-muted/60 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 mb-4 cursor-pointer">
          <Camera className="w-7 h-7 text-muted-foreground/50" />
          <p className="text-[10px] font-semibold text-muted-foreground">Tap to take photo</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button className="py-2.5 rounded-xl border border-border bg-card text-[10px] font-semibold flex items-center justify-center gap-1"><Camera className="w-3.5 h-3.5" />Camera</button>
          <button className="py-2.5 rounded-xl border border-border bg-card text-[10px] font-semibold flex items-center justify-center gap-1"><ImageIcon className="w-3.5 h-3.5" />Gallery</button>
        </div>
        <button className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-[11px] flex items-center justify-center gap-1.5"><Upload className="w-3.5 h-3.5" />Submit & Complete</button>
      </div>
    </div>
  );
}
