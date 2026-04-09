import { AlertTriangle, XCircle } from "lucide-react";
import type { PerformanceAlert } from "@/types/performance";

interface Props {
  alerts: PerformanceAlert[];
}

export default function PerformanceAlertBanner({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
            alert.severity === "critical"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-yellow-50 text-yellow-800 border border-yellow-200"
          }`}
        >
          {alert.severity === "critical" ? (
            <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-500" />
          )}
          <div>
            <p className="font-semibold">{alert.label}</p>
            <p className="text-xs opacity-80 mt-0.5">{alert.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
