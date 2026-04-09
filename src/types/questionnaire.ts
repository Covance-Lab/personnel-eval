export type QuestionnaireMonthKey = string; // "YYYY-MM"

export interface MonthlyQuestionnaireAnswer {
  submittedAt: string; // ISO
  answers: {
    selfCheck?: string;
    nextAction?: string;
    rating?: 1 | 2 | 3 | 4 | 5;
  };
}

