import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertTriangle, XCircle, CheckCircle, AlertCircle } from "lucide-react";

interface Props {
  total: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export default function SummaryStats({ total, low, medium, high, critical }: Props) {
  const stats = [
    {
      label: "総アポインター数",
      value: total,
      icon: Users,
      color: "text-gray-700",
      bg: "bg-gray-100",
      iconColor: "text-gray-500",
    },
    {
      label: "低リスク",
      value: low,
      icon: CheckCircle,
      color: "text-green-700",
      bg: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      label: "中リスク",
      value: medium,
      icon: AlertCircle,
      color: "text-yellow-700",
      bg: "bg-yellow-50",
      iconColor: "text-yellow-500",
    },
    {
      label: "高リスク",
      value: high,
      icon: AlertTriangle,
      color: "text-orange-700",
      bg: "bg-orange-50",
      iconColor: "text-orange-500",
    },
    {
      label: "要対応",
      value: critical,
      icon: XCircle,
      color: "text-red-700",
      bg: "bg-red-50",
      iconColor: "text-red-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className={`${s.bg} border-0`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-medium ${s.color}`}>{s.label}</p>
              <s.icon className={`w-4 h-4 ${s.iconColor}`} />
            </div>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
