import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { AuthService } from 'src/app/auth/auth.service';

@Component({
  selector: 'app-step-up',
  standalone: true,
  imports: [RouterModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './step-up.component.html',
})
export class StepUpComponent {
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);
  private readonly route       = inject(ActivatedRoute);

  isSubmitting = false;
  error        = '';
  hidePassword = true;

  form = new FormGroup({
    password: new FormControl('', [Validators.required]),
  });

  get f() { return this.form.controls; }

  async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.error = '';
    this.isSubmitting = true;

    try {
      await this.authService.stepUp(this.form.controls.password.value ?? '');
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/schedule';
      this.router.navigateByUrl(returnUrl);
    } catch {
      this.error = 'Incorrect password. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }
}
