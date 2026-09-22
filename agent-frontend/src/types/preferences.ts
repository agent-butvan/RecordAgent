export type StudyWindowMode = 'page' | 'in-app' | 'desktop';

export interface ChatTopBarPreferences {
  showDate: boolean;
  showTodos: boolean;
  showFinance: boolean;
  showHoliday: boolean;
  showWeather: boolean;
}

export interface CalendarPreferences {
  showStickyNotes: boolean;
  stickyNotesDefaultExpanded: boolean;
}

export interface FeaturePreferences {
  studyWindowMode: StudyWindowMode;
  chatTopBar: ChatTopBarPreferences;
  calendar: CalendarPreferences;
}
