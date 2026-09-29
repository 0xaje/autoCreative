/**
 * Section 10 & 11: Browser Agent & Browser Action
 */

export type BrowserAction =
  | {
      type: "click";
      target: string;
      description?: string;
    }
  | {
      type: "type";
      target: string;
      value: string;
      description?: string;
    }
  | {
      type: "scroll";
      direction: "up" | "down";
      amount?: number;
      description?: string;
    }
  | {
      type: "wait";
      milliseconds: number;
      description?: string;
    }
  | {
      type: "navigate";
      url: string;
      description?: string;
    }
  | {
      type: "screenshot";
      name: string;
      description?: string;
    };

export interface ActionResult {
  action: BrowserAction;
  success: boolean;
  durationMs: number;
  error?: string;
  screenshotPath?: string;
}

export interface PageUnderstanding {
  url: string;
  title: string;
  headings: string[];
  navLinks: Array<{ text: string; href: string }>;
  interactiveElements: Array<{ tag: string; text: string; role?: string; id?: string }>;
  forms: Array<{ action?: string; inputs: string[] }>;
  heroScreenshot?: string;
}

export interface RecordingSession {
  sessionId: string;
  startedAt: string;
  outputPath: string;
}
