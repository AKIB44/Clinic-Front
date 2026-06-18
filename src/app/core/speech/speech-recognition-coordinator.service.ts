import { Injectable, signal } from '@angular/core';

/** Ensures only one Web Speech API consumer uses the microphone at a time. */
@Injectable({ providedIn: 'root' })
export class SpeechRecognitionCoordinatorService {
  private readonly holder = signal<string | null>(null);

  readonly activeHolder = this.holder.asReadonly();

  request(owner: string): boolean {
    const current = this.holder();
    if (current && current !== owner) return false;
    this.holder.set(owner);
    return true;
  }

  release(owner: string): void {
    if (this.holder() === owner) {
      this.holder.set(null);
    }
  }
}
