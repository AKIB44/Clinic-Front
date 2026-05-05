import {
  Component, Input, Output, EventEmitter, OnChanges, OnInit,
  inject, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RxMasterService } from '../../../services/rx-master.service';
import { RxProcedure } from '../rx.interfaces';

@Component({
  selector: 'app-procedure-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './procedure-picker.component.html',
  styleUrls: ['./procedure-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcedurePickerComponent implements OnInit, OnChanges {
  @Input()  svcId!:     string;
  @Input()  excludeIds: number[] = [];
  @Output() procedureSelected = new EventEmitter<RxProcedure>();

  private master = inject(RxMasterService);

  all       = signal<RxProcedure[]>([]);
  available = signal<RxProcedure[]>([]);
  open      = signal(false);

  async ngOnInit(): Promise<void> {
    const procs = await this.master.getProcedures(this.svcId);
    this.all.set(procs);
    this._updateAvailable();
  }

  ngOnChanges(): void {
    this._updateAvailable();
  }

  private _updateAvailable(): void {
    this.available.set(
      this.all().filter(p => !this.excludeIds.includes(p.id))
    );
  }

  select(proc: RxProcedure): void {
    this.procedureSelected.emit(proc);
    this.open.set(false);
  }

  toggleOpen(): void { this.open.update(v => !v); }
  trackById(_: number, item: RxProcedure): number { return item.id; }
}
