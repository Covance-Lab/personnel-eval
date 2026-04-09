"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserId, getSetupForUserId } from "@/lib/userStorage";
import QuestionnaireForm from "@/components/questionnaire/QuestionnaireForm";

export default function QuestionnairePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const current = getCurrentUserId();
    if (!current) {
      router.replace("/login");
      return;
    }
    const setup = getSetupForUserId(current);
    if (!setup?.completed) {
      router.replace("/setup");
      return;
    }
    setUserId(current);
  }, [router]);

  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p>読み込み中...</p>
      </div>
    );
  }

  return <QuestionnaireForm userId={userId} />;
}

