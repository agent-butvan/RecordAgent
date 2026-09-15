export type StudyWindowMode = 'page' | 'in-app' | 'desktop';

export interface ChatTopBarPreferences {
  showDate: boolean;
  showTodos: boolean;
  showFinance: boolean;
}

export interface FeaturePreferences {
  studyWindowMode: StudyWindowMode;
  chatTopBar: ChatTopBarPreferences;
}
