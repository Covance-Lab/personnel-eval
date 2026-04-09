import { CHURN_RISK_CONFIG, type ChurnRiskLevel } from "@/types/evaluation";
import { AlertTriangle, CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface Props {
  level: ChurnRiskLevel;
  score?: number;
  showScore?: boolean;
}

const ICONS: Record<ChurnRiskLevel, React.ComponentType<{ className?: string }>> = {
  low:      CheckCircle,
  medium:   AlertCircle,
  high:     AlertTriangle,
  critical: XCircle,
};

export default function ChurnRiskBadge({ level, score, showScore = false }: Props) {
  const config = CHURN_RISK_CONFIG[level];
  const Icon = ICONS[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.color} ${config.bgColor}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
      {showScore && score !== undefined && (
        <span className="opacity-70">({score})</span>
      )}
    </span>
  );
}
