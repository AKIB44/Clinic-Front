import { CanDeactivateFn } from '@angular/router';
import { SessionCanvasPage } from '../pages/session-canvas.page';

/** Auto-pause an in-progress treatment session before leaving the canvas. */
export const sessionAutoPauseGuard: CanDeactivateFn<SessionCanvasPage> = (component) =>
  component.canDeactivate();
