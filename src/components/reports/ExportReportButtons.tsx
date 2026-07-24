import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ExportReportButtonsProps {
  reportName: string;
}

export function ExportReportButtons({ reportName }: ExportReportButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.success(`${reportName} diekspor ke PDF (mock)`)}
      >
        <Download className="h-4 w-4 mr-1.5" /> Export PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.success(`${reportName} diekspor ke Excel (mock)`)}
      >
        <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Export Excel
      </Button>
    </div>
  );
}
