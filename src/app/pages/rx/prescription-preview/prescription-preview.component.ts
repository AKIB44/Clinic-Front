import {
  Component, Input, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MedFormItem, ProcFormItem } from '../rx.interfaces';

@Component({
  selector: 'app-prescription-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prescription-preview.component.html',
  styleUrls: ['./prescription-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrescriptionPreviewComponent {
  @Input() medicines:     MedFormItem[]  = [];
  @Input() procedures:    ProcFormItem[] = [];
  @Input() diagnosis:     string | null  = null;
  @Input() clinicalNotes: string | null  = null;
  @Input() patientName:   string         = '';
  @Input() rxNo:          string | null  = null;

  today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}
