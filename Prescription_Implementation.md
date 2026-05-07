# DentaFlow — Prescription & Procedure Model
## Implementation Guide · Sequelize + Umzug · Angular Component Structure

> **Stack:** Angular 17+ · Signals · OnPush · Node.js 20 · Express 4 · Sequelize 6 · Umzug 3 · MySQL 8 · Bull · PDFKit · AWS S3  
> **Version:** v2.0 · May 2026 · Akib Tamboli — Solutions Architect  
> **Prerequisite:** Base DentaFlow running with Sequelize already configured for existing models

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Sequelize Setup & DB Connection](#2-sequelize-setup--db-connection)
3. [Umzug Migration Runner](#3-umzug-migration-runner)
4. [Migrations](#4-migrations)
5. [Sequelize Models](#5-sequelize-models)
6. [Master Data Seeders](#6-master-data-seeders)
7. [Backend — Validators](#7-backend--validators)
8. [Backend — Repository Layer](#8-backend--repository-layer)
9. [Backend — Service Layer](#9-backend--service-layer)
10. [Backend — Controllers](#10-backend--controllers)
11. [Backend — Routes](#11-backend--routes)
12. [Backend — PDF Worker](#12-backend--pdf-worker)
13. [Backend — PDF Builder](#13-backend--pdf-builder)
14. [Backend — WA Worker](#14-backend--wa-worker)
15. [Frontend — Module & Routes](#15-frontend--module--routes)
16. [Frontend — Interfaces & Types](#16-frontend--interfaces--types)
17. [Frontend — RxMasterService](#17-frontend--rxmasterservice)
18. [Frontend — PrescriptionService](#18-frontend--prescriptionservice)
19. [Frontend — PrescriptionFormComponent](#19-frontend--prescriptionformcomponent)
20. [Frontend — MedicineSearchComponent](#20-frontend--medicinesearchcomponent)
21. [Frontend — MedicineLineItemComponent](#21-frontend--medicinelineitemcomponent)
22. [Frontend — ProcedurePickerComponent](#22-frontend--procedurepickercomponent)
23. [Frontend — PrescriptionPreviewComponent](#23-frontend--prescriptionpreviewcomponent)
24. [Frontend — RxHistoryTabComponent](#24-frontend--rxhistorytabcomponent)
25. [Frontend — AppointmentDetail Integration](#25-frontend--appointmentdetail-integration)
26. [Implementation Checklist](#26-implementation-checklist)

---

## 1. Architecture Overview

```
Doctor opens "New Prescription" in appointment detail
  │
  ├── GET /api/rx/master/defaults?svc_id=SVC-03
  │     └── Redis cache hit? → return · miss? → Sequelize query → cache 5min
  │           RxServiceDefault.findAll({ include: [RxMedicine] })
  │           RxProcedure.findAll({ where: { svcId } })
  │
  ├── PrescriptionFormComponent (Angular Signals + OnPush)
  │     ├── MedicineSearchComponent    → debounced search-ahead
  │     ├── MedicineLineItemComponent  → per-row edit (dosage/duration/qty)
  │     ├── ProcedurePickerComponent   → checkbox list per svcId
  │     └── PrescriptionPreviewComponent → read-only HTML preview
  │
  ├── POST /api/rx/prescriptions
  │     └── Sequelize transaction:
  │           RxSequence.increment + SELECT FOR UPDATE → DRX-YYYY-NNNN
  │           Prescription.create({ ... })
  │           RxLineItem.bulkCreate([...])
  │
  ├── POST /api/rx/prescriptions/:id/generate
  │     └── Bull pdfQueue.add('generate_rx_pdf', { prescriptionId })
  │           pdf-worker:
  │             Prescription.findByPk + include all associations
  │             rxPdfBuilder.build(rx) → Buffer
  │             S3 putObject (AES-256)
  │             rx.update({ pdfS3Key, pdfGenerated: true })
  │
  └── waQueue.add('prescription_ready', { ... })
        wa-worker: Meta BSP → patient WA (< 10 seconds)
        rx.update({ waSent: true })
```

---

## 2. Sequelize Setup & DB Connection

### `src/db/sequelize.js`

```javascript
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host:    process.env.DB_HOST,
    port:    parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max:     20,
      min:     5,
      acquire: 30000,
      idle:    10000,
    },
    define: {
      underscored:   true,   // snake_case columns
      timestamps:    true,
      createdAt:     'created_at',
      updatedAt:     'updated_at',
      charset:       'utf8mb4',
      collate:       'utf8mb4_unicode_ci',
    },
  }
);

// Read replica for heavy read queries (schedule, patient lists, Rx history)
const sequelizeRead = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_READ_USER,
  process.env.DB_READ_PASS,
  {
    host:    process.env.DB_REPLICA_HOST || process.env.DB_HOST,
    port:    parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: false,
    pool:    { max: 30, min: 5, acquire: 30000, idle: 10000 },
    define:  { underscored: true, timestamps: true,
                createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = { sequelize, sequelizeRead };
```

---

## 3. Umzug Migration Runner

### `src/db/umzug.js`

```javascript
const { Umzug, SequelizeStorage } = require('umzug');
const { sequelize } = require('./sequelize');
const path = require('path');

const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, '../../migrations/rx/*.js'),
    resolve: ({ name, path: migPath, context }) => {
      const migration = require(migPath);
      return {
        name,
        up:   async () => migration.up(context.queryInterface,   context.Sequelize),
        down: async () => migration.down(context.queryInterface, context.Sequelize),
      };
    },
  },
  context: {
    queryInterface: sequelize.getQueryInterface(),
    Sequelize:      require('sequelize'),
  },
  storage: new SequelizeStorage({ sequelize }),
  logger:  console,
});

// CLI usage:  node src/db/umzug.js up
//             node src/db/umzug.js down
//             node src/db/umzug.js status
if (require.main === module) {
  const command = process.argv[2];
  if (!['up', 'down', 'status', 'pending', 'executed'].includes(command)) {
    console.error('Usage: node umzug.js [up|down|status|pending|executed]');
    process.exit(1);
  }
  umzug[command]()
    .then(result => { console.log(JSON.stringify(result, null, 2)); process.exit(0); })
    .catch(err   => { console.error(err); process.exit(1); });
}

module.exports = umzug;
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "migrate:rx:up":     "node src/db/umzug.js up",
    "migrate:rx:down":   "node src/db/umzug.js down",
    "migrate:rx:status": "node src/db/umzug.js status",
    "seed:rx":           "node src/db/seeders/rxMasterSeeder.js"
  }
}
```

---

## 4. Migrations

All files live in `migrations/rx/`. Umzug runs them in filename-alphabetical order.

### `migrations/rx/010_create_rx_sequence.js`

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rx_sequence', {
      fy_year: {
        type:       Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        allowNull:  false,
        comment:    'Financial year e.g. 2026',
      },
      last_seq: {
        type:         Sequelize.INTEGER.UNSIGNED,
        allowNull:    false,
        defaultValue: 0,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('rx_sequence');
  },
};
```

### `migrations/rx/011_create_rx_medicines.js`

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rx_medicines', {
      id: {
        type:          Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey:    true,
      },
      generic_name: {
        type:      Sequelize.STRING(150),
        allowNull: false,
      },
      brand_name: {
        type:      Sequelize.STRING(150),
        allowNull: true,
      },
      category: {
        type:      Sequelize.ENUM(
          'antibiotic', 'analgesic', 'anti_inflammatory',
          'antifungal',  'antiseptic', 'vitamin', 'topical', 'other'
        ),
        allowNull: false,
      },
      dosage_form: {
        type:      Sequelize.ENUM(
          'tablet', 'capsule', 'syrup', 'gel',
          'drops', 'injection', 'mouthwash'
        ),
        allowNull: false,
      },
      strength: {
        type:      Sequelize.STRING(50),
        allowNull: false,
      },
      default_dose: {
        type:      Sequelize.STRING(80),
        allowNull: true,
      },
      default_days: {
        type:      Sequelize.TINYINT.UNSIGNED,
        allowNull: true,
      },
      is_active: {
        type:         Sequelize.BOOLEAN,
        allowNull:    false,
        defaultValue: true,
      },
      notes: {
        type:      Sequelize.STRING(500),
        allowNull: true,
      },
      created_at: {
        type:      Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type:      Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('rx_medicines', ['category'],   { name: 'idx_category' });
    await queryInterface.addIndex('rx_medicines', ['is_active'],  { name: 'idx_active' });
    await queryInterface.addIndex('rx_medicines', ['generic_name'], { name: 'idx_name' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('rx_medicines');
  },
};
```

### `migrations/rx/012_create_rx_procedures.js`

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rx_procedures', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true,
      },
      procedure_code: {
        type: Sequelize.STRING(30), allowNull: false,
      },
      procedure_name: {
        type: Sequelize.STRING(200), allowNull: false,
      },
      svc_id: {
        type: Sequelize.STRING(10), allowNull: false,
      },
      procedure_step: {
        type: Sequelize.TINYINT.UNSIGNED, allowNull: true,
      },
      default_notes: {
        type: Sequelize.TEXT, allowNull: true,
      },
      duration_days: {
        type: Sequelize.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0,
      },
      followup_days: {
        type: Sequelize.TINYINT.UNSIGNED, allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('rx_procedures', ['procedure_code'],
      { name: 'uq_proc_code', unique: true });
    await queryInterface.addIndex('rx_procedures', ['svc_id'],   { name: 'idx_svc' });
    await queryInterface.addIndex('rx_procedures', ['is_active'],{ name: 'idx_active' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('rx_procedures');
  },
};
```

### `migrations/rx/013_create_rx_service_defaults.js`

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rx_service_defaults', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true,
      },
      svc_id: {
        type: Sequelize.STRING(10), allowNull: false,
      },
      medicine_id: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'rx_medicines', key: 'id' },
        onDelete: 'CASCADE',
      },
      sort_order: {
        type: Sequelize.TINYINT.UNSIGNED, allowNull: false, defaultValue: 1,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('rx_service_defaults', ['svc_id'], { name: 'idx_svc' });
    await queryInterface.addIndex('rx_service_defaults',
      ['svc_id', 'medicine_id'], { name: 'uq_svc_med', unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('rx_service_defaults');
  },
};
```

### `migrations/rx/014_create_prescriptions.js`

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('prescriptions', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true,
      },
      prescription_no: {
        type: Sequelize.STRING(30), allowNull: false,
      },
      patient_id: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'patients', key: 'id' },
      },
      appointment_id: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'appointments', key: 'id' },
      },
      doctor_id: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      diagnosis: {
        type: Sequelize.STRING(500), allowNull: true,
      },
      clinical_notes: {
        type: Sequelize.TEXT, allowNull: true,
      },
      pdf_s3_key: {
        type: Sequelize.STRING(500), allowNull: true,
      },
      pdf_generated: {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
      },
      pdf_generated_at: {
        type: Sequelize.DATE, allowNull: true,
      },
      wa_sent: {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
      },
      wa_sent_at: {
        type: Sequelize.DATE, allowNull: true,
      },
      valid_days: {
        type: Sequelize.TINYINT.UNSIGNED, allowNull: false, defaultValue: 7,
      },
      refillable: {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('prescriptions',
      ['prescription_no'],  { name: 'uq_rx_no', unique: true });
    await queryInterface.addIndex('prescriptions',
      ['appointment_id'],   { name: 'uq_appointment', unique: true });
    await queryInterface.addIndex('prescriptions',
      ['patient_id'],       { name: 'idx_patient' });
    await queryInterface.addIndex('prescriptions',
      ['created_at'],       { name: 'idx_created' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('prescriptions');
  },
};
```

### `migrations/rx/015_create_rx_line_items.js`

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rx_line_items', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true,
      },
      prescription_id: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'prescriptions', key: 'id' },
        onDelete: 'CASCADE',
      },
      item_type: {
        type: Sequelize.ENUM('medicine', 'procedure'), allowNull: false,
      },
      ref_id: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        comment: 'FK to rx_medicines.id OR rx_procedures.id depending on item_type',
      },
      sort_order: {
        type: Sequelize.TINYINT.UNSIGNED, allowNull: false, defaultValue: 1,
      },
      // Medicine fields
      dosage:     { type: Sequelize.STRING(80),  allowNull: true },
      frequency:  { type: Sequelize.STRING(60),  allowNull: true },
      duration:   { type: Sequelize.STRING(40),  allowNull: true },
      quantity:   { type: Sequelize.STRING(40),  allowNull: true },
      // Procedure field
      procedure_status: {
        type:         Sequelize.ENUM('planned', 'done', 'skipped'),
        allowNull:    true,
        defaultValue: 'planned',
      },
      // Shared
      instructions: { type: Sequelize.TEXT, allowNull: true },
      is_deleted: {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('rx_line_items',
      ['prescription_id'], { name: 'idx_prescription' });
    await queryInterface.addIndex('rx_line_items',
      ['prescription_id', 'is_deleted'], { name: 'idx_active_lines' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('rx_line_items');
  },
};
```

---

## 5. Sequelize Models

All models live in `src/models/`. Register each in `src/models/index.js`.

### `src/models/RxSequence.js`

```javascript
const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/sequelize');

const RxSequence = sequelize.define('RxSequence', {
  fyYear: {
    type:       DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    field:      'fy_year',
  },
  lastSeq: {
    type:         DataTypes.INTEGER.UNSIGNED,
    allowNull:    false,
    defaultValue: 0,
    field:        'last_seq',
  },
}, {
  tableName:  'rx_sequence',
  timestamps: false,
});

module.exports = RxSequence;
```

### `src/models/RxMedicine.js`

```javascript
const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/sequelize');

const RxMedicine = sequelize.define('RxMedicine', {
  id:           { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  genericName:  { type: DataTypes.STRING(150), allowNull: false,  field: 'generic_name' },
  brandName:    { type: DataTypes.STRING(150), allowNull: true,   field: 'brand_name' },
  category: {
    type: DataTypes.ENUM(
      'antibiotic','analgesic','anti_inflammatory',
      'antifungal','antiseptic','vitamin','topical','other'
    ),
    allowNull: false,
  },
  dosageForm: {
    type: DataTypes.ENUM('tablet','capsule','syrup','gel','drops','injection','mouthwash'),
    allowNull: false,
    field: 'dosage_form',
  },
  strength:     { type: DataTypes.STRING(50),  allowNull: false },
  defaultDose:  { type: DataTypes.STRING(80),  allowNull: true, field: 'default_dose' },
  defaultDays:  { type: DataTypes.TINYINT,     allowNull: true, field: 'default_days' },
  isActive:     { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  notes:        { type: DataTypes.STRING(500), allowNull: true },
}, {
  tableName:  'rx_medicines',
  underscored: true,
  scopes: {
    active: { where: { isActive: true } },
  },
});

module.exports = RxMedicine;
```

### `src/models/RxProcedure.js`

```javascript
const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/sequelize');

const RxProcedure = sequelize.define('RxProcedure', {
  id:             { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  procedureCode:  { type: DataTypes.STRING(30),  allowNull: false, field: 'procedure_code' },
  procedureName:  { type: DataTypes.STRING(200), allowNull: false, field: 'procedure_name' },
  svcId:          { type: DataTypes.STRING(10),  allowNull: false, field: 'svc_id' },
  procedureStep:  { type: DataTypes.TINYINT,     allowNull: true,  field: 'procedure_step' },
  defaultNotes:   { type: DataTypes.TEXT,        allowNull: true,  field: 'default_notes' },
  durationDays:   { type: DataTypes.TINYINT,     defaultValue: 0,  field: 'duration_days' },
  followupDays:   { type: DataTypes.TINYINT,     allowNull: true,  field: 'followup_days' },
  isActive:       { type: DataTypes.BOOLEAN,     defaultValue: true, field: 'is_active' },
}, {
  tableName:   'rx_procedures',
  underscored: true,
  scopes: {
    active:       { where: { isActive: true } },
    forService:   (svcId) => ({ where: { svcId, isActive: true } }),
  },
});

module.exports = RxProcedure;
```

### `src/models/RxServiceDefault.js`

```javascript
const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/sequelize');

const RxServiceDefault = sequelize.define('RxServiceDefault', {
  id:         { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  svcId:      { type: DataTypes.STRING(10), allowNull: false, field: 'svc_id' },
  medicineId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'medicine_id' },
  sortOrder:  { type: DataTypes.TINYINT.UNSIGNED, defaultValue: 1, field: 'sort_order' },
}, {
  tableName:   'rx_service_defaults',
  underscored: true,
});

module.exports = RxServiceDefault;
```

### `src/models/Prescription.js`

```javascript
const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/sequelize');

const Prescription = sequelize.define('Prescription', {
  id:              { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  prescriptionNo:  { type: DataTypes.STRING(30), allowNull: false, field: 'prescription_no' },
  patientId:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'patient_id' },
  appointmentId:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'appointment_id' },
  doctorId:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'doctor_id' },
  diagnosis:       { type: DataTypes.STRING(500), allowNull: true },
  clinicalNotes:   { type: DataTypes.TEXT,        allowNull: true,  field: 'clinical_notes' },
  pdfS3Key:        { type: DataTypes.STRING(500), allowNull: true,  field: 'pdf_s3_key' },
  pdfGenerated:    { type: DataTypes.BOOLEAN,     defaultValue: false, field: 'pdf_generated' },
  pdfGeneratedAt:  { type: DataTypes.DATE,        allowNull: true, field: 'pdf_generated_at' },
  waSent:          { type: DataTypes.BOOLEAN,     defaultValue: false, field: 'wa_sent' },
  waSentAt:        { type: DataTypes.DATE,        allowNull: true, field: 'wa_sent_at' },
  validDays:       { type: DataTypes.TINYINT,     defaultValue: 7, field: 'valid_days' },
  refillable:      { type: DataTypes.BOOLEAN,     defaultValue: false },
}, {
  tableName:   'prescriptions',
  underscored: true,
});

module.exports = Prescription;
```

### `src/models/RxLineItem.js`

```javascript
const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/sequelize');

const RxLineItem = sequelize.define('RxLineItem', {
  id:              { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  prescriptionId:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'prescription_id' },
  itemType:        { type: DataTypes.ENUM('medicine','procedure'), allowNull: false, field: 'item_type' },
  refId:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'ref_id' },
  sortOrder:       { type: DataTypes.TINYINT.UNSIGNED, defaultValue: 1, field: 'sort_order' },
  dosage:          { type: DataTypes.STRING(80),  allowNull: true },
  frequency:       { type: DataTypes.STRING(60),  allowNull: true },
  duration:        { type: DataTypes.STRING(40),  allowNull: true },
  quantity:        { type: DataTypes.STRING(40),  allowNull: true },
  procedureStatus: {
    type:         DataTypes.ENUM('planned','done','skipped'),
    allowNull:    true,
    defaultValue: 'planned',
    field:        'procedure_status',
  },
  instructions: { type: DataTypes.TEXT,    allowNull: true },
  isDeleted:    { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_deleted' },
}, {
  tableName:   'rx_line_items',
  underscored: true,
  scopes: {
    active: { where: { isDeleted: false } },
  },
});

module.exports = RxLineItem;
```

### `src/models/index.js` — register associations

```javascript
// Add to existing associations block:
const Prescription     = require('./Prescription');
const RxLineItem       = require('./RxLineItem');
const RxMedicine       = require('./RxMedicine');
const RxProcedure      = require('./RxProcedure');
const RxServiceDefault = require('./RxServiceDefault');
const RxSequence       = require('./RxSequence');
// Existing models already imported:
const Patient          = require('./Patient');
const Appointment      = require('./Appointment');
const User             = require('./User');

// ── Prescription associations ─────────────────────────────────────
Prescription.belongsTo(Patient,     { foreignKey: 'patient_id',     as: 'patient' });
Prescription.belongsTo(Appointment, { foreignKey: 'appointment_id', as: 'appointment' });
Prescription.belongsTo(User,        { foreignKey: 'doctor_id',      as: 'doctor' });
Prescription.hasMany(RxLineItem,    { foreignKey: 'prescription_id', as: 'lineItems' });
RxLineItem.belongsTo(Prescription,  { foreignKey: 'prescription_id' });

// ── Master data associations ──────────────────────────────────────
RxServiceDefault.belongsTo(RxMedicine, { foreignKey: 'medicine_id', as: 'medicine' });
RxMedicine.hasMany(RxServiceDefault,   { foreignKey: 'medicine_id' });

module.exports = {
  sequelize, Prescription, RxLineItem, RxMedicine,
  RxProcedure, RxServiceDefault, RxSequence,
  Patient, Appointment, User,
};
```

---

## 6. Master Data Seeders

### `src/db/seeders/rxMasterSeeder.js`

```javascript
'use strict';

const { sequelize, RxMedicine, RxProcedure, RxServiceDefault } = require('../../models');

async function seed() {
  const t = await sequelize.transaction();
  try {
    // ── Medicines ─────────────────────────────────────────────────
    const meds = await RxMedicine.bulkCreate([
      // Antibiotics
      { genericName: 'Amoxicillin',               brandName: 'Amoxil / Mox',
        category: 'antibiotic',       dosageForm: 'tablet',    strength: '500mg',
        defaultDose: '1-0-1 after food', defaultDays: 5,
        notes: 'Broad spectrum — RCT, Extraction, Implant' },

      { genericName: 'Amoxicillin + Clavulanate',  brandName: 'Augmentin',
        category: 'antibiotic',       dosageForm: 'tablet',    strength: '625mg',
        defaultDose: '1-0-1 after food', defaultDays: 5,
        notes: 'Severe infection — Extraction, Implant' },

      { genericName: 'Metronidazole',              brandName: 'Flagyl / Metrogyl',
        category: 'antibiotic',       dosageForm: 'tablet',    strength: '400mg',
        defaultDose: '1-1-1 after food', defaultDays: 5,
        notes: 'Anaerobic coverage — Extraction, Periodontics' },

      { genericName: 'Azithromycin',               brandName: 'Zithromax',
        category: 'antibiotic',       dosageForm: 'tablet',    strength: '500mg',
        defaultDose: '1-0-0',            defaultDays: 3,
        notes: 'Penicillin allergy alternative' },

      { genericName: 'Doxycycline',                brandName: 'Doxt',
        category: 'antibiotic',       dosageForm: 'capsule',   strength: '100mg',
        defaultDose: '1-0-1 after food', defaultDays: 7,
        notes: 'Periodontal adjunct' },

      // Analgesics / Anti-inflammatory
      { genericName: 'Ibuprofen',                  brandName: 'Brufen / Combiflam',
        category: 'anti_inflammatory', dosageForm: 'tablet',   strength: '400mg',
        defaultDose: '1-1-1 after food', defaultDays: 3,
        notes: 'Standard pain — all services' },

      { genericName: 'Paracetamol',                brandName: 'Crocin / Dolo',
        category: 'analgesic',        dosageForm: 'tablet',    strength: '500mg',
        defaultDose: '1-1-1 after food', defaultDays: 3,
        notes: 'Mild pain — safe if NSAIDs contraindicated' },

      { genericName: 'Diclofenac',                 brandName: 'Voveran',
        category: 'anti_inflammatory', dosageForm: 'tablet',   strength: '50mg',
        defaultDose: '0-1-1 after food', defaultDays: 3,
        notes: 'Stronger anti-inflammatory — post-surgical' },

      // GI protection
      { genericName: 'Pantoprazole',               brandName: 'Pan / Pantodac',
        category: 'other',            dosageForm: 'tablet',    strength: '40mg',
        defaultDose: '1-0-0 before breakfast', defaultDays: 5,
        notes: 'GI protection with antibiotics' },

      // Antiseptic
      { genericName: 'Chlorhexidine mouthwash',    brandName: 'Hexidine / Clohex',
        category: 'antiseptic',       dosageForm: 'mouthwash', strength: '0.2%',
        defaultDose: 'Rinse 30ml 2x/day', defaultDays: 7,
        notes: 'Post-scaling, post-extraction, RCT' },

      // Topical
      { genericName: 'Clove oil (eugenol)',         brandName: 'Clove Oil',
        category: 'topical',          dosageForm: 'drops',     strength: 'pure',
        defaultDose: '2 drops on cotton SOS', defaultDays: null,
        notes: 'Inter-session RCT pain relief' },

      { genericName: 'Lignocaine gel',              brandName: 'Xylocaine 2%',
        category: 'topical',          dosageForm: 'gel',       strength: '2%',
        defaultDose: 'Apply before procedure', defaultDays: null,
        notes: 'Topical anaesthesia pre-injection' },

      { genericName: 'Fluoride varnish',            brandName: 'Fluor Protector',
        category: 'topical',          dosageForm: 'gel',       strength: '5%',
        defaultDose: 'Apply post-scaling', defaultDays: null,
        notes: 'SVC-01 Oral Prophylaxis' },

      // Vitamins
      { genericName: 'Vitamin C + Zinc',            brandName: 'Limcee + Zincovit',
        category: 'vitamin',          dosageForm: 'tablet',    strength: 'combo',
        defaultDose: '1-0-0', defaultDays: 7,
        notes: 'Post-implant healing support' },
    ], { transaction: t, ignoreDuplicates: true });

    // ── Procedures ────────────────────────────────────────────────
    await RxProcedure.bulkCreate([
      // SVC-01
      { procedureCode: 'PROP-SCAL', procedureName: 'Scaling and polishing',
        svcId: 'SVC-01', procedureStep: null,
        defaultNotes: 'Avoid hard/crunchy food for 24 hours. Mild sensitivity normal for 48 hours. Use soft toothbrush.',
        durationDays: 1, followupDays: 180 },

      // SVC-02
      { procedureCode: 'REST-COMP', procedureName: 'Composite restoration',
        svcId: 'SVC-02', procedureStep: null,
        defaultNotes: 'Avoid biting on filled side for 2 hours. No staining foods for 24 hours.',
        durationDays: 1, followupDays: 7 },

      // SVC-03 RCT (4 steps)
      { procedureCode: 'RCT-ACCESS', procedureName: 'Access opening and pulp extirpation',
        svcId: 'SVC-03', procedureStep: 1,
        defaultNotes: 'Sensitivity expected for 24-48 hours. Use clove oil on cotton SOS. Avoid hard food on this side.',
        durationDays: 2, followupDays: 7 },

      { procedureCode: 'RCT-BIOM',   procedureName: 'Biomechanical preparation',
        svcId: 'SVC-03', procedureStep: 2,
        defaultNotes: 'Mild soreness normal for 2-3 days. Continue antibiotics. Return immediately if severe swelling or fever above 101F.',
        durationDays: 3, followupDays: 7 },

      { procedureCode: 'RCT-OBTUR',  procedureName: 'Obturation (gutta-percha fill)',
        svcId: 'SVC-03', procedureStep: 3,
        defaultNotes: 'Tooth may feel tender 3-5 days. Crown placement is next and final step — book within 2 weeks.',
        durationDays: 5, followupDays: 14 },

      { procedureCode: 'RCT-CROWN',  procedureName: 'Post and core plus crown placement',
        svcId: 'SVC-03', procedureStep: 4,
        defaultNotes: 'Avoid very hard foods on crown for 1 week. Annual review recommended.',
        durationDays: 0, followupDays: 365 },

      // SVC-04 Extraction
      { procedureCode: 'EXT-SIMPLE', procedureName: 'Simple extraction',
        svcId: 'SVC-04', procedureStep: null,
        defaultNotes: 'Bite on gauze 30 minutes. No rinsing for 24 hours. No smoking or alcohol for 48 hours. Soft foods 3 days.',
        durationDays: 3, followupDays: 7 },

      { procedureCode: 'EXT-SURG',   procedureName: 'Surgical extraction (impacted tooth)',
        svcId: 'SVC-04', procedureStep: null,
        defaultNotes: 'Swelling peaks at 48 hours. Ice pack first 24 hours. Stitches removed in 7 days.',
        durationDays: 5, followupDays: 7 },

      // SVC-05 Orthodontics
      { procedureCode: 'ORTHO-BOND', procedureName: 'Bracket bonding session',
        svcId: 'SVC-05', procedureStep: null,
        defaultNotes: 'Mild soreness 3-5 days — completely normal. Avoid sticky/hard foods.',
        durationDays: 3, followupDays: 30 },

      { procedureCode: 'ORTHO-ADJ',  procedureName: 'Wire adjustment and activation',
        svcId: 'SVC-05', procedureStep: null,
        defaultNotes: 'Teeth sore 2-4 days after each adjustment. Take paracetamol if needed.',
        durationDays: 2, followupDays: 30 },

      { procedureCode: 'ORTHO-DEB',  procedureName: 'Debonding and retainer fitting',
        svcId: 'SVC-05', procedureStep: null,
        defaultNotes: 'Wear retainer as instructed — full time first 6 months then night only.',
        durationDays: 1, followupDays: 30 },

      // SVC-06 Implant (3 steps)
      { procedureCode: 'IMP-PLACE',  procedureName: 'Implant fixture placement',
        svcId: 'SVC-06', procedureStep: 1,
        defaultNotes: 'Swelling and bruising normal 3-5 days. Soft foods only 2 weeks. No smoking critical for osseointegration. NO hard biting on implant site for 90 days.',
        durationDays: 7, followupDays: 90 },

      { procedureCode: 'IMP-ABUT',   procedureName: 'Abutment placement (post-osseointegration)',
        svcId: 'SVC-06', procedureStep: 2,
        defaultNotes: 'Gum may be slightly sore for a few days. Soft toothbrush around abutment.',
        durationDays: 3, followupDays: 14 },

      { procedureCode: 'IMP-CROWN',  procedureName: 'Implant crown delivery',
        svcId: 'SVC-06', procedureStep: 3,
        defaultNotes: 'Avoid very hard foods on crown for 1 week. Floss daily around implant. Annual review mandatory.',
        durationDays: 0, followupDays: 365 },

      // SVC-07 Paediatric Pulpectomy (3 steps)
      { procedureCode: 'PULP-PULP',  procedureName: 'Pulpectomy and medicated dressing',
        svcId: 'SVC-07', procedureStep: 1,
        defaultNotes: 'Child may have mild soreness 1-2 days. Give paracetamol syrup if uncomfortable. Bring child back if severe swelling or fever.',
        durationDays: 2, followupDays: 7 },

      { procedureCode: 'PULP-FILL',  procedureName: 'Pulp canal filling with ZOE paste',
        svcId: 'SVC-07', procedureStep: 2,
        defaultNotes: 'Avoid hard foods on this side. Child should have minimal discomfort.',
        durationDays: 1, followupDays: 7 },

      { procedureCode: 'PULP-CROWN', procedureName: 'Stainless steel crown placement',
        svcId: 'SVC-07', procedureStep: 3,
        defaultNotes: 'The stainless steel crown will come out with the baby tooth naturally. Brush and floss normally.',
        durationDays: 0, followupDays: 180 },
    ], { transaction: t, ignoreDuplicates: true });

    // ── Service defaults (medicine auto-load per service) ─────────
    const findMed = async (name) => {
      const m = await RxMedicine.findOne({ where: { genericName: name }, transaction: t });
      return m?.id;
    };

    const defRows = [];

    // SVC-01
    const chlorhex = await findMed('Chlorhexidine mouthwash');
    const fluoride  = await findMed('Fluoride varnish');
    if (chlorhex) defRows.push({ svcId: 'SVC-01', medicineId: chlorhex, sortOrder: 1 });
    if (fluoride)  defRows.push({ svcId: 'SVC-01', medicineId: fluoride,  sortOrder: 2 });

    // SVC-03 RCT
    const mapsRct = [
      ['Amoxicillin', 1], ['Ibuprofen', 2],
      ['Pantoprazole', 3], ['Clove oil (eugenol)', 4],
      ['Chlorhexidine mouthwash', 5],
    ];
    for (const [name, order] of mapsRct) {
      const id = await findMed(name);
      if (id) defRows.push({ svcId: 'SVC-03', medicineId: id, sortOrder: order });
    }

    // SVC-04 Extraction
    const mapsExt = [
      ['Amoxicillin', 1], ['Metronidazole', 2],
      ['Ibuprofen', 3],   ['Pantoprazole', 4],
      ['Chlorhexidine mouthwash', 5],
    ];
    for (const [name, order] of mapsExt) {
      const id = await findMed(name);
      if (id) defRows.push({ svcId: 'SVC-04', medicineId: id, sortOrder: order });
    }

    // SVC-06 Implant
    const mapsImp = [
      ['Amoxicillin + Clavulanate', 1], ['Ibuprofen', 2],
      ['Pantoprazole', 3], ['Vitamin C + Zinc', 4],
    ];
    for (const [name, order] of mapsImp) {
      const id = await findMed(name);
      if (id) defRows.push({ svcId: 'SVC-06', medicineId: id, sortOrder: order });
    }

    // SVC-07 Paediatric
    for (const [name, order] of [['Paracetamol', 1], ['Amoxicillin', 2]]) {
      const id = await findMed(name);
      if (id) defRows.push({ svcId: 'SVC-07', medicineId: id, sortOrder: order });
    }

    await RxServiceDefault.bulkCreate(defRows, { transaction: t, ignoreDuplicates: true });

    await t.commit();
    console.log('✅ Rx master data seeded successfully');
  } catch (err) {
    await t.rollback();
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
```

---

## 7. Backend — Validators

### `src/validators/rxValidators.js`

```javascript
const { z } = require('zod');

const lineItemSchema = z.object({
  itemType: z.enum(['medicine', 'procedure']),
  refId:    z.number().int().positive('ref_id must reference a valid medicine or procedure'),
  sortOrder: z.number().int().min(1).max(50).default(1),
  // Medicine
  dosage:    z.string().max(80).optional(),
  frequency: z.string().max(60).optional(),
  duration:  z.string().max(40).optional(),
  quantity:  z.string().max(40).optional(),
  // Procedure
  procedureStatus: z.enum(['planned', 'done', 'skipped']).optional(),
  // Shared
  instructions: z.string().max(2000).optional(),
});

exports.rxCreateSchema = z.object({
  patientId:     z.number().int().positive(),
  appointmentId: z.number().int().positive(),
  diagnosis:     z.string().max(500).optional(),
  clinicalNotes: z.string().max(5000).optional(),
  validDays:     z.number().int().min(1).max(365).default(7),
  refillable:    z.boolean().default(false),
  items:         z.array(lineItemSchema).min(1, 'At least one medicine or procedure required').max(50),
});

exports.rxUpdateSchema = z.object({
  diagnosis:     z.string().max(500).optional(),
  clinicalNotes: z.string().max(5000).optional(),
  items:         z.array(lineItemSchema).min(1).max(50).optional(),
});
```

---

## 8. Backend — Repository Layer

The repository abstracts all Sequelize queries. The service calls the repository — never Sequelize directly from the service.

### `src/repositories/rxRepository.js`

```javascript
const { Op }           = require('sequelize');
const { sequelize, sequelizeRead } = require('../db/sequelize');
const {
  RxSequence, Prescription, RxLineItem,
  RxMedicine, RxProcedure, RxServiceDefault,
  Patient, User,
} = require('../models');

// ── Rx# sequence (atomic, primary DB only) ────────────────────────

exports.nextRxNumber = async (transaction) => {
  const year = new Date().getFullYear();

  // Upsert: insert year with seq=1 or increment existing
  await sequelize.query(
    `INSERT INTO rx_sequence (fy_year, last_seq)
     VALUES (:year, 1)
     ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
    { replacements: { year }, transaction }
  );

  const [result] = await sequelize.query(
    `SELECT last_seq FROM rx_sequence WHERE fy_year = :year FOR UPDATE`,
    { replacements: { year }, transaction, type: sequelize.QueryTypes.SELECT }
  );

  return `DRX-${year}-${String(result.last_seq).padStart(4, '0')}`;
};

// ── Master data (read replica) ────────────────────────────────────

exports.findMedicines = ({ search, category } = {}) => {
  const where = { isActive: true };
  if (category) where.category = category;
  if (search)   where.genericName = { [Op.like]: `%${search}%` };

  return RxMedicine.findAll({
    where,
    order: [['genericName', 'ASC']],
    attributes: [
      'id','genericName','brandName','category',
      'dosageForm','strength','defaultDose','defaultDays','notes',
    ],
  });
};

exports.findProcedures = ({ svcId } = {}) => {
  const where = { isActive: true };
  if (svcId) where.svcId = svcId;

  return RxProcedure.findAll({
    where,
    order: [['procedureStep','ASC'], ['procedureName','ASC']],
    attributes: [
      'id','procedureCode','procedureName','svcId',
      'procedureStep','defaultNotes','durationDays','followupDays',
    ],
  });
};

exports.findDefaultsForService = (svcId) =>
  RxServiceDefault.findAll({
    where:   { svcId },
    order:   [['sortOrder','ASC']],
    include: [{
      model:      RxMedicine,
      as:         'medicine',
      where:      { isActive: true },
      attributes: [
        'id','genericName','brandName','dosageForm',
        'strength','defaultDose','defaultDays',
      ],
    }],
  });

// ── Prescription CRUD ─────────────────────────────────────────────

exports.createPrescription = (data, transaction) =>
  Prescription.create(data, { transaction });

exports.bulkCreateLineItems = (items, transaction) =>
  RxLineItem.bulkCreate(items, { transaction });

exports.softDeleteLineItems = (prescriptionId, transaction) =>
  RxLineItem.update(
    { isDeleted: true },
    { where: { prescriptionId }, transaction }
  );

exports.findPrescriptionById = (id) =>
  Prescription.findByPk(id, {
    include: [
      {
        model:      Patient,
        as:         'patient',
        attributes: ['id','name','phone','parentPhone','isPaediatric'],
      },
      {
        model:      User,
        as:         'doctor',
        attributes: ['id','name','designation'],
      },
      {
        model:   RxLineItem,
        as:      'lineItems',
        where:   { isDeleted: false },
        required: false,
        order:   [['sortOrder','ASC']],
      },
    ],
  });

exports.listPrescriptionsForPatient = (patientId, { page = 1, limit = 10 } = {}) =>
  Prescription.findAndCountAll({
    where:  { patientId },
    order:  [['createdAt','DESC']],
    limit,
    offset: (page - 1) * limit,
    attributes: [
      'id','prescriptionNo','diagnosis',
      'pdfGenerated','waSent','createdAt','validDays',
    ],
  });

exports.updatePrescription = (id, data, transaction) =>
  Prescription.update(data, { where: { id }, transaction });

exports.markPdfReady = (id, pdfS3Key) =>
  Prescription.update(
    { pdfS3Key, pdfGenerated: true, pdfGeneratedAt: new Date() },
    { where: { id } }
  );

exports.markWaSent = (id) =>
  Prescription.update(
    { waSent: true, waSentAt: new Date() },
    { where: { id } }
  );

// Admin
exports.createMedicine = (data) => RxMedicine.create(data);
exports.updateMedicine  = (id, data) => RxMedicine.update(data, { where: { id } });
exports.createProcedure = (data) => RxProcedure.create(data);
```

---

## 9. Backend — Service Layer

### `src/services/rxService.js`

```javascript
const { sequelize } = require('../db/sequelize');
const redis         = require('../db/redis');
const rxRepo        = require('../repositories/rxRepository');
const { pdfQueue, waQueue } = require('../queues');
const { getSignedUrl }      = require('./s3Service');

const CACHE_TTL = 300; // 5 minutes

// ── Master data ───────────────────────────────────────────────────

exports.getMedicines = async ({ search, category }) => {
  // Only cache un-filtered full-list fetches
  if (!search) {
    const key    = `rx:medicines:${category || 'all'}`;
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
    const rows = await rxRepo.findMedicines({ category });
    await redis.setex(key, CACHE_TTL, JSON.stringify(rows));
    return rows;
  }
  return rxRepo.findMedicines({ search, category });
};

exports.getProcedures = async ({ svcId }) => {
  const key    = `rx:procedures:${svcId || 'all'}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  const rows = await rxRepo.findProcedures({ svcId });
  await redis.setex(key, CACHE_TTL, JSON.stringify(rows));
  return rows;
};

exports.getDefaults = async (svcId) => {
  const key    = `rx:defaults:${svcId}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const [defaults, procedures] = await Promise.all([
    rxRepo.findDefaultsForService(svcId),
    rxRepo.findProcedures({ svcId }),
  ]);

  const result = {
    medicines:  defaults.map(d => d.medicine),
    procedures: procedures,
  };
  await redis.setex(key, CACHE_TTL, JSON.stringify(result));
  return result;
};

exports.invalidateMasterCache = async () => {
  const keys = await redis.keys('rx:*');
  if (keys.length) await redis.del(...keys);
};

// ── Prescription CRUD ─────────────────────────────────────────────

exports.createPrescription = async (data, doctorId) => {
  return sequelize.transaction(async (t) => {
    // Atomic Rx# generation
    const prescriptionNo = await rxRepo.nextRxNumber(t);

    const rx = await rxRepo.createPrescription({
      prescriptionNo,
      patientId:     data.patientId,
      appointmentId: data.appointmentId,
      doctorId,
      diagnosis:     data.diagnosis    || null,
      clinicalNotes: data.clinicalNotes || null,
      validDays:     data.validDays,
      refillable:    data.refillable,
    }, t);

    const lineItems = data.items.map((item, idx) => ({
      prescriptionId:  rx.id,
      itemType:        item.itemType,
      refId:           item.refId,
      sortOrder:       item.sortOrder || idx + 1,
      dosage:          item.dosage           || null,
      frequency:       item.frequency        || null,
      duration:        item.duration         || null,
      quantity:        item.quantity         || null,
      procedureStatus: item.procedureStatus  || 'planned',
      instructions:    item.instructions     || null,
    }));

    await rxRepo.bulkCreateLineItems(lineItems, t);
    return { id: rx.id, prescriptionNo: rx.prescriptionNo };
  });
};

exports.updatePrescription = async (id, data) => {
  return sequelize.transaction(async (t) => {
    const headFields = {};
    if (data.diagnosis    !== undefined) headFields.diagnosis    = data.diagnosis;
    if (data.clinicalNotes !== undefined) headFields.clinicalNotes = data.clinicalNotes;
    if (Object.keys(headFields).length)
      await rxRepo.updatePrescription(id, headFields, t);

    if (data.items) {
      await rxRepo.softDeleteLineItems(id, t);
      const lineItems = data.items.map((item, idx) => ({
        prescriptionId:  id,
        itemType:        item.itemType,
        refId:           item.refId,
        sortOrder:       item.sortOrder || idx + 1,
        dosage:          item.dosage           || null,
        frequency:       item.frequency        || null,
        duration:        item.duration         || null,
        quantity:        item.quantity         || null,
        procedureStatus: item.procedureStatus  || 'planned',
        instructions:    item.instructions     || null,
      }));
      await rxRepo.bulkCreateLineItems(lineItems, t);
    }
  });
};

exports.listPrescriptions = async ({ patientId, page, limit }) => {
  const { count, rows } = await rxRepo.listPrescriptionsForPatient(
    patientId, { page, limit }
  );
  return {
    data:  rows,
    total: count,
    page:  Number(page),
    limit: Number(limit),
  };
};

exports.getFullPrescription = async (id) =>
  rxRepo.findPrescriptionById(id);

// ── PDF + WA ──────────────────────────────────────────────────────

exports.queuePdfGeneration = async (prescriptionId) => {
  const rx = await exports.getFullPrescription(prescriptionId);
  if (!rx)              throw new Error('Prescription not found');
  if (rx.pdfGenerated)  throw new Error('PDF already generated');

  const job = await pdfQueue.add('generate_rx_pdf', { prescriptionId });
  return job.id;
};

exports.getPresignedPdfUrl = async (prescriptionId) => {
  const rx = await rxRepo.findPrescriptionById(prescriptionId);
  if (!rx || !rx.pdfGenerated || !rx.pdfS3Key) return null;
  return getSignedUrl(rx.pdfS3Key, 900);
};

exports.queueWaSend = async (prescriptionId) => {
  const rx  = await exports.getFullPrescription(prescriptionId);
  if (!rx.pdfGenerated) throw new Error('Generate PDF before sending');
  const url   = await exports.getPresignedPdfUrl(prescriptionId);
  const phone = rx.patient.isPaediatric ? rx.patient.parentPhone : rx.patient.phone;

  await waQueue.add('prescription_ready', {
    prescriptionId,
    phone,
    patientName:    rx.patient.name,
    prescriptionNo: rx.prescriptionNo,
    doctorName:     rx.doctor.name,
    pdfUrl:         url,
  });
};

exports.markPdfReady = (id, s3Key) => rxRepo.markPdfReady(id, s3Key);
exports.markWaSent   = (id)        => rxRepo.markWaSent(id);
```

---

## 10. Backend — Controllers

### `src/controllers/rxController.js`

```javascript
const rxService = require('../services/rxService');
const { rxCreateSchema, rxUpdateSchema } = require('../validators/rxValidators');

const ok   = (res, data, status = 200) => res.status(status).json(data);
const fail = (res, msg, status = 400) => res.status(status).json({ error: msg });

exports.getMedicines = async (req, res, next) => {
  try {
    const data = await rxService.getMedicines(req.query);
    ok(res, { data });
  } catch (e) { next(e); }
};

exports.getProcedures = async (req, res, next) => {
  try {
    const data = await rxService.getProcedures(req.query);
    ok(res, { data });
  } catch (e) { next(e); }
};

exports.getDefaults = async (req, res, next) => {
  try {
    const { svc_id } = req.query;
    if (!svc_id) return fail(res, 'svc_id is required');
    const data = await rxService.getDefaults(svc_id);
    ok(res, { data });
  } catch (e) { next(e); }
};

exports.createPrescription = async (req, res, next) => {
  try {
    const parsed = rxCreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    const result = await rxService.createPrescription(parsed.data, req.user.id);
    ok(res, result, 201);
  } catch (e) { next(e); }
};

exports.listPrescriptions = async (req, res, next) => {
  try {
    const { patient_id, page = 1, limit = 10 } = req.query;
    if (!patient_id) return fail(res, 'patient_id required');
    const data = await rxService.listPrescriptions({
      patientId: parseInt(patient_id), page: parseInt(page), limit: parseInt(limit),
    });
    ok(res, data);
  } catch (e) { next(e); }
};

exports.getPrescription = async (req, res, next) => {
  try {
    const rx = await rxService.getFullPrescription(req.params.id);
    if (!rx) return fail(res, 'Prescription not found', 404);
    ok(res, { data: rx });
  } catch (e) { next(e); }
};

exports.updatePrescription = async (req, res, next) => {
  try {
    const parsed = rxUpdateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    await rxService.updatePrescription(req.params.id, parsed.data);
    ok(res, { success: true });
  } catch (e) { next(e); }
};

exports.generatePdf = async (req, res, next) => {
  try {
    const jobId = await rxService.queuePdfGeneration(req.params.id);
    ok(res, { jobId, message: 'PDF generation queued' });
  } catch (e) { next(e); }
};

exports.getPdfUrl = async (req, res, next) => {
  try {
    const url = await rxService.getPresignedPdfUrl(req.params.id);
    if (!url) return fail(res, 'PDF not yet generated', 404);
    ok(res, { url });
  } catch (e) { next(e); }
};

exports.sendOnWA = async (req, res, next) => {
  try {
    await rxService.queueWaSend(req.params.id);
    ok(res, { success: true });
  } catch (e) { next(e); }
};
```

### `src/controllers/rxAdminController.js`

```javascript
const rxRepo    = require('../repositories/rxRepository');
const rxService = require('../services/rxService');

exports.addMedicine = async (req, res, next) => {
  try {
    const med = await rxRepo.createMedicine(req.body);
    await rxService.invalidateMasterCache();
    res.status(201).json({ data: med });
  } catch (e) { next(e); }
};

exports.updateMedicine = async (req, res, next) => {
  try {
    await rxRepo.updateMedicine(req.params.id, req.body);
    await rxService.invalidateMasterCache();
    res.json({ success: true });
  } catch (e) { next(e); }
};

exports.addProcedure = async (req, res, next) => {
  try {
    const proc = await rxRepo.createProcedure(req.body);
    await rxService.invalidateMasterCache();
    res.status(201).json({ data: proc });
  } catch (e) { next(e); }
};
```

---

## 11. Backend — Routes

### `src/routes/rxRoutes.js`

```javascript
const express  = require('express');
const router   = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl      = require('../controllers/rxController');
const adminCtrl = require('../controllers/rxAdminController');

// Master data
router.get('/master/medicines',         authenticate, ctrl.getMedicines);
router.get('/master/procedures',        authenticate, ctrl.getProcedures);
router.get('/master/defaults',          authenticate, ctrl.getDefaults);

// Prescription CRUD
router.post('/prescriptions',           authenticate, ctrl.createPrescription);
router.get('/prescriptions',            authenticate, ctrl.listPrescriptions);
router.get('/prescriptions/:id',        authenticate, ctrl.getPrescription);
router.put('/prescriptions/:id',        authenticate, ctrl.updatePrescription);

// PDF + WA
router.post('/prescriptions/:id/generate', authenticate, ctrl.generatePdf);
router.get('/prescriptions/:id/pdf',       authenticate, ctrl.getPdfUrl);
router.post('/prescriptions/:id/send',     authenticate, ctrl.sendOnWA);

// Admin
router.post('/master/medicines',        authenticate, requireRole('admin'), adminCtrl.addMedicine);
router.patch('/master/medicines/:id',   authenticate, requireRole('admin'), adminCtrl.updateMedicine);
router.post('/master/procedures',       authenticate, requireRole('admin'), adminCtrl.addProcedure);

module.exports = router;
```

Register in `src/server.js`:

```javascript
app.use('/api/rx', require('./routes/rxRoutes'));
```

---

## 12. Backend — PDF Worker

### `src/workers/pdf-worker.js` — add processor

```javascript
const { pdfQueue }     = require('../queues');
const rxService        = require('../services/rxService');
const rxPdfBuilder     = require('../services/rxPdfBuilder');
const { uploadBuffer } = require('../services/s3Service');

pdfQueue.process('generate_rx_pdf', 1, async (job) => {
  const { prescriptionId } = job.data;

  // 1. Load full prescription via Sequelize (includes patient, doctor, lineItems)
  const rx = await rxService.getFullPrescription(prescriptionId);
  if (!rx) throw new Error(`Prescription ${prescriptionId} not found`);

  // 2. Build PDF buffer
  const pdfBuffer = await rxPdfBuilder.build(rx);

  // 3. Upload to S3
  const s3Key = `prescriptions/${rx.patientId}/${rx.prescriptionNo}.pdf`;
  await uploadBuffer({
    key:         s3Key,
    buffer:      pdfBuffer,
    contentType: 'application/pdf',
    encrypt:     true,
  });

  // 4. Mark as generated
  await rxService.markPdfReady(prescriptionId, s3Key);

  // 5. Queue WA send
  await rxService.queueWaSend(prescriptionId);

  return { prescriptionId, s3Key };
});
```

---

## 13. Backend — PDF Builder

### `src/services/rxPdfBuilder.js`

```javascript
'use strict';

const PDFDocument = require('pdfkit');

const C = {
  TEAL:  '#0D7A5F',
  NAVY:  '#0F172A',
  GRAY:  '#64748B',
  LIGHT: '#E2E8F0',
};

/**
 * Build a prescription PDF from a Sequelize Prescription instance.
 * Returns a Buffer.
 *
 * @param {object} rx  - Prescription model with patient, doctor, lineItems associations
 * @returns {Promise<Buffer>}
 */
exports.build = (rx) =>
  new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data',  c => chunks.push(c));
    doc.on('end',   ()  => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    _header(doc, rx);
    _patientStrip(doc, rx);
    _diagnosisLine(doc, rx);
    _medicines(doc, rx.lineItems.filter(i => i.itemType === 'medicine'));
    _procedures(doc, rx.lineItems.filter(i => i.itemType === 'procedure'));
    _instructions(doc, rx.clinicalNotes);
    _signature(doc, rx);
    _footer(doc, rx);

    doc.end();
  });

function _header(doc, rx) {
  doc.fontSize(16).fillColor(C.TEAL).font('Helvetica-Bold')
     .text('Sharayu Dental Clinic', 40, 40, { align: 'left' });
  doc.fontSize(10).fillColor(C.GRAY).font('Helvetica')
     .text(`Dr. ${rx.doctor.name} · ${rx.doctor.designation || 'BDS/MDS'}`, 40, 62)
     .text('Karve Road, Pune 411004  ·  +91 98765 43210', 40, 76);
  doc.moveTo(40, 96).lineTo(555, 96).strokeColor(C.LIGHT).lineWidth(0.5).stroke();
}

function _patientStrip(doc, rx) {
  const dateStr = new Date(rx.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  doc.fontSize(9).fillColor(C.NAVY).font('Helvetica')
     .text(`Patient: ${rx.patient.name}`,  40, 106)
     .text(`Phone: ${rx.patient.phone}`,   220, 106)
     .text(`Date: ${dateStr}`,             390, 106)
     .fillColor(C.TEAL).font('Helvetica-Bold')
     .text(`Rx#: ${rx.prescriptionNo}`,    40, 120);
  doc.moveTo(40, 136).lineTo(555, 136).strokeColor(C.LIGHT).lineWidth(0.5).stroke();
}

function _diagnosisLine(doc, rx) {
  if (!rx.diagnosis) return;
  doc.fontSize(9).fillColor(C.NAVY)
     .font('Helvetica-Bold').text('Diagnosis: ', 40, 146, { continued: true })
     .font('Helvetica').text(rx.diagnosis);
  doc.moveTo(40, doc.y + 6).lineTo(555, doc.y + 6).strokeColor(C.LIGHT).lineWidth(0.5).stroke();
}

function _medicines(doc, medicines) {
  if (!medicines.length) return;
  doc.fontSize(22).fillColor(C.TEAL).font('Helvetica-Bold').text('Rx', 40, doc.y + 12);
  let y = doc.y + 4;

  medicines.forEach((item, i) => {
    // Access joined fields from RxLineItem (medicine fields stored directly)
    doc.fontSize(9).fillColor(C.NAVY).font('Helvetica-Bold')
       .text(`${i + 1}.`, 55, y, { continued: true })
       .text(`  ${item.rxMedicineName || ''} ${item.rxMedicineStrength || ''}`)
       .font('Helvetica').fillColor(C.GRAY)
       .text(item.dosage || '', 55, y + 12)
       .text(item.frequency || '', 220, y + 12)
       .text(item.duration || '', 360, y + 12)
       .text(item.quantity || '', 460, y + 12);
    y += 30;
  });

  doc.moveTo(40, y + 4).lineTo(555, y + 4).strokeColor(C.LIGHT).lineWidth(0.5).stroke();
}

function _procedures(doc, procedures) {
  if (!procedures.length) return;
  let y = doc.y + 12;
  doc.fontSize(9).fillColor(C.NAVY).font('Helvetica-Bold')
     .text('Procedures:', 40, y);
  y += 14;

  procedures.forEach((item, i) => {
    const statusLabel = item.procedureStatus === 'done'
      ? '✓ Done' : item.procedureStatus === 'skipped' ? '— Skipped' : '○ Planned';
    doc.fontSize(9).font('Helvetica').fillColor(C.GRAY)
       .text(`${i + 1}.  ${item.rxProcedureName || ''}  (${statusLabel})`, 55, y);
    y += 14;
  });

  doc.moveTo(40, y + 4).lineTo(555, y + 4).strokeColor(C.LIGHT).lineWidth(0.5).stroke();
}

function _instructions(doc, notes) {
  if (!notes) return;
  const y = doc.y + 12;
  doc.fontSize(9).fillColor(C.NAVY).font('Helvetica-Bold').text('Post-care instructions:', 40, y);
  doc.fontSize(9).font('Helvetica').fillColor(C.GRAY).text(notes, 40, doc.y + 4, { width: 515 });
}

function _signature(doc, rx) {
  const sigY = doc.page.height - 100;
  doc.moveTo(395, sigY).lineTo(555, sigY).strokeColor(C.GRAY).lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor(C.NAVY).font('Helvetica-Bold')
     .text(`Dr. ${rx.doctor.name}`, 395, sigY + 6, { width: 160, align: 'center' });
  doc.fontSize(7).fillColor(C.GRAY).font('Helvetica')
     .text(rx.doctor.designation || '', 395, sigY + 18, { width: 160, align: 'center' });
  doc.fontSize(7).fillColor(C.GRAY)
     .text(`Valid ${rx.validDays} days  ·  Refill: ${rx.refillable ? 'Yes' : 'No'}`, 40, sigY + 6);
}

function _footer(doc, rx) {
  const y = doc.page.height - 40;
  doc.fontSize(7).fillColor(C.GRAY).font('Helvetica')
     .text('Generated by DentaFlow  ·  dentaflow.in', 40, y)
     .text(rx.prescriptionNo, 455, y, { width: 100, align: 'right' });
}
```

> **Note on joined field names:** Because `RxLineItem` does not have a Sequelize `belongsTo(RxMedicine)` association (since `ref_id` is polymorphic), the worker enriches `lineItems` with medicine/procedure names before calling the builder. Add this enrichment step in `pdf-worker.js` after loading the prescription:

```javascript
// In pdf-worker.js, after loadingfull prescription:
const { RxMedicine, RxProcedure } = require('../models');

// Enrich medicine line items
for (const item of rx.lineItems.filter(i => i.itemType === 'medicine')) {
  const med = await RxMedicine.findByPk(item.refId,
    { attributes: ['genericName','strength'] });
  item.rxMedicineName    = med?.genericName || '';
  item.rxMedicineStrength = med?.strength   || '';
}

// Enrich procedure line items
for (const item of rx.lineItems.filter(i => i.itemType === 'procedure')) {
  const proc = await RxProcedure.findByPk(item.refId,
    { attributes: ['procedureName'] });
  item.rxProcedureName = proc?.procedureName || '';
}
```

---

## 14. Backend — WA Worker

### Add to `src/workers/wa-worker.js`

```javascript
// Inside the existing job.data.template switch / if-else chain:

case 'prescription_ready': {
  const { prescriptionId, phone, patientName,
          prescriptionNo, doctorName, pdfUrl } = job.data;

  await waSendTemplate(phone, 'prescription_ready', [
    { type: 'text', text: patientName    },
    { type: 'text', text: prescriptionNo },
    { type: 'text', text: doctorName     },
    { type: 'text', text: pdfUrl         },
  ]);

  await rxService.markWaSent(prescriptionId);
  break;
}
```

> **Meta template body** (submit for approval):  
> *"Hello {{1}}, your prescription {{2}} from Dr. {{3}} at Sharayu Dental is ready. Download here: {{4}} (link valid 15 minutes)."*

---

## 15. Frontend — Module & Routes

### File structure

```
admin/src/app/rx/
├── rx.module.ts
├── rx-routing.module.ts
├── interfaces/
│   └── rx.interfaces.ts
├── services/
│   ├── rx-master.service.ts
│   └── prescription.service.ts
├── prescription-form/
│   ├── prescription-form.component.ts
│   ├── prescription-form.component.html
│   └── prescription-form.component.scss
├── medicine-search/
│   ├── medicine-search.component.ts
│   ├── medicine-search.component.html
│   └── medicine-search.component.scss
├── medicine-line-item/
│   ├── medicine-line-item.component.ts
│   ├── medicine-line-item.component.html
│   └── medicine-line-item.component.scss
├── procedure-picker/
│   ├── procedure-picker.component.ts
│   ├── procedure-picker.component.html
│   └── procedure-picker.component.scss
├── prescription-preview/
│   ├── prescription-preview.component.ts
│   ├── prescription-preview.component.html
│   └── prescription-preview.component.scss
└── rx-history-tab/
    ├── rx-history-tab.component.ts
    ├── rx-history-tab.component.html
    └── rx-history-tab.component.scss
```

### `rx-routing.module.ts`

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PrescriptionFormComponent } from './prescription-form/prescription-form.component';

const routes: Routes = [
  { path: 'new',      component: PrescriptionFormComponent },
  { path: ':id/edit', component: PrescriptionFormComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RxRoutingModule {}
```

### `rx.module.ts`

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RxRoutingModule } from './rx-routing.module';

import { PrescriptionFormComponent }    from './prescription-form/prescription-form.component';
import { MedicineSearchComponent }      from './medicine-search/medicine-search.component';
import { MedicineLineItemComponent }    from './medicine-line-item/medicine-line-item.component';
import { ProcedurePickerComponent }     from './procedure-picker/procedure-picker.component';
import { PrescriptionPreviewComponent } from './prescription-preview/prescription-preview.component';
import { RxHistoryTabComponent }        from './rx-history-tab/rx-history-tab.component';

@NgModule({
  declarations: [
    PrescriptionFormComponent,
    MedicineSearchComponent,
    MedicineLineItemComponent,
    ProcedurePickerComponent,
    PrescriptionPreviewComponent,
    RxHistoryTabComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RxRoutingModule,
  ],
  exports: [
    RxHistoryTabComponent, // used in patient-record
  ],
})
export class RxModule {}
```

Register lazy route in `app-routing.module.ts`:

```typescript
{
  path:         'rx',
  loadChildren: () => import('./rx/rx.module').then(m => m.RxModule),
  canActivate:  [AuthGuard],
},
```

---

## 16. Frontend — Interfaces & Types

### `rx/interfaces/rx.interfaces.ts`

```typescript
export interface RxMedicine {
  id:          number;
  genericName: string;
  brandName:   string | null;
  category:    string;
  dosageForm:  string;
  strength:    string;
  defaultDose: string | null;
  defaultDays: number | null;
  notes:       string | null;
}

export interface RxProcedure {
  id:            number;
  procedureCode: string;
  procedureName: string;
  svcId:         string;
  procedureStep: number | null;
  defaultNotes:  string | null;
  followupDays:  number | null;
}

export interface RxDefaults {
  medicines:  RxMedicine[];
  procedures: RxProcedure[];
}

export type ProcedureStatus = 'planned' | 'done' | 'skipped';

/** A medicine row in the prescription form */
export interface MedFormItem extends RxMedicine {
  dosage:       string;
  frequency:    string;
  duration:     string;
  quantity:     string;
  instructions: string;
}

/** A procedure row in the prescription form */
export interface ProcFormItem extends RxProcedure {
  status: ProcedureStatus;
}

export interface LineItemPayload {
  itemType:        'medicine' | 'procedure';
  refId:           number;
  sortOrder:       number;
  dosage?:         string;
  frequency?:      string;
  duration?:       string;
  quantity?:       string;
  procedureStatus?: ProcedureStatus;
  instructions?:   string;
}

export interface CreateRxPayload {
  patientId:     number;
  appointmentId: number;
  diagnosis?:    string;
  clinicalNotes?: string;
  validDays?:    number;
  refillable?:   boolean;
  items:         LineItemPayload[];
}

export interface RxSummary {
  id:             number;
  prescriptionNo: string;
  diagnosis:      string | null;
  pdfGenerated:   boolean;
  waSent:         boolean;
  createdAt:      string;
  validDays:      number;
}

export interface PrescriptionContext {
  appointmentId:    number;
  patientId:        number;
  svcId:            string;
  patientName:      string;
  appointmentLabel: string;
}
```

---

## 17. Frontend — RxMasterService

### `rx/services/rx-master.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RxMedicine, RxProcedure, RxDefaults } from '../interfaces/rx.interfaces';

@Injectable({ providedIn: 'root' })
export class RxMasterService {
  private http  = inject(HttpClient);
  private base  = `${environment.apiUrl}/rx`;

  // Session-scoped in-memory cache — complements Redis server cache
  private readonly _defCache = new Map<string, RxDefaults>();
  private readonly _medCache = new Map<string, RxMedicine[]>();

  async getDefaults(svcId: string): Promise<RxDefaults> {
    if (this._defCache.has(svcId)) return this._defCache.get(svcId)!;
    const { data } = await firstValueFrom(
      this.http.get<{ data: RxDefaults }>(
        `${this.base}/master/defaults`, { params: { svc_id: svcId } }
      )
    );
    this._defCache.set(svcId, data);
    return data;
  }

  async getMedicines(search = '', category?: string): Promise<RxMedicine[]> {
    const key = `${search}:${category ?? ''}`;
    if (!search && this._medCache.has(key)) return this._medCache.get(key)!;

    let params = new HttpParams();
    if (search)   params = params.set('search',   search);
    if (category) params = params.set('category', category);

    const { data } = await firstValueFrom(
      this.http.get<{ data: RxMedicine[] }>(`${this.base}/master/medicines`, { params })
    );
    if (!search) this._medCache.set(key, data);
    return data;
  }

  async getProcedures(svcId: string): Promise<RxProcedure[]> {
    const defaults = await this.getDefaults(svcId);
    return defaults.procedures;
  }

  clearCache(): void {
    this._defCache.clear();
    this._medCache.clear();
  }
}
```

---

## 18. Frontend — PrescriptionService

### `rx/services/prescription.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, interval, switchMap, takeWhile, lastValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateRxPayload, RxSummary } from '../interfaces/rx.interfaces';

interface CreateResult { id: number; prescriptionNo: string; }
interface PdfUrlResult { url: string | null; }

@Injectable({ providedIn: 'root' })
export class PrescriptionService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/rx`;

  create(payload: CreateRxPayload) {
    return firstValueFrom(
      this.http.post<CreateResult>(`${this.base}/prescriptions`, payload)
    );
  }

  update(id: number, payload: Partial<CreateRxPayload>) {
    return firstValueFrom(
      this.http.put<{ success: boolean }>(`${this.base}/prescriptions/${id}`, payload)
    );
  }

  get(id: number) {
    return firstValueFrom(
      this.http.get<{ data: any }>(`${this.base}/prescriptions/${id}`)
    );
  }

  listForPatient(patientId: number, page = 1, limit = 10) {
    return firstValueFrom(
      this.http.get<{ data: RxSummary[]; total: number }>(
        `${this.base}/prescriptions`,
        { params: { patient_id: patientId, page, limit } }
      )
    );
  }

  generatePdf(id: number) {
    return firstValueFrom(
      this.http.post<{ jobId: string }>(`${this.base}/prescriptions/${id}/generate`, {})
    );
  }

  getPdfUrl(id: number) {
    return firstValueFrom(
      this.http.get<PdfUrlResult>(`${this.base}/prescriptions/${id}/pdf`)
    );
  }

  sendOnWA(id: number) {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.base}/prescriptions/${id}/send`, {})
    );
  }

  /**
   * Poll GET /pdf every 3 seconds until a URL is returned.
   * Stops after 30 attempts (~90 seconds) and rejects.
   */
  async pollUntilPdfReady(id: number): Promise<string> {
    let attempts = 0;
    const result = await lastValueFrom(
      interval(3000).pipe(
        switchMap(() => this.http.get<PdfUrlResult>(`${this.base}/prescriptions/${id}/pdf`)),
        takeWhile(res => {
          attempts++;
          if (res.url) return false;          // stop — got URL
          if (attempts >= 30) throw new Error('PDF generation timed out after 90 seconds');
          return true;                        // keep polling
        }, true),                             // emit last value (the one with url)
      )
    );
    if (!result?.url) throw new Error('PDF URL not available');
    return result.url;
  }
}
```

---

## 19. Frontend — PrescriptionFormComponent

### `prescription-form/prescription-form.component.ts`

```typescript
import {
  Component, OnInit, inject, signal, computed,
  ChangeDetectionStrategy, Input,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RxMasterService } from '../services/rx-master.service';
import { PrescriptionService } from '../services/prescription.service';
import {
  MedFormItem, ProcFormItem, RxMedicine, RxProcedure,
  LineItemPayload, PrescriptionContext,
} from '../interfaces/rx.interfaces';

@Component({
  selector: 'app-prescription-form',
  templateUrl: './prescription-form.component.html',
  styleUrls: ['./prescription-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrescriptionFormComponent implements OnInit {
  // Passed via @Input when opened from AppointmentDetailComponent
  @Input() ctx?: PrescriptionContext;

  private route  = inject(ActivatedRoute);
  private master = inject(RxMasterService);
  private rxSvc  = inject(PrescriptionService);
  private fb     = inject(FormBuilder);

  // ── Resolved context ──────────────────────────────────────────
  context!: PrescriptionContext;

  // ── UI state signals ──────────────────────────────────────────
  loading    = signal(true);
  saving     = signal(false);
  generating = signal(false);
  showPreview = signal(false);

  savedId    = signal<number | null>(null);
  savedRxNo  = signal<string | null>(null);
  pdfUrl     = signal<string | null>(null);
  waSent     = signal(false);
  errorMsg   = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  // ── Form data signals ─────────────────────────────────────────
  medicines  = signal<MedFormItem[]>([]);
  procedures = signal<ProcFormItem[]>([]);

  // Reactive form for text fields
  form!: FormGroup;

  // Computed payload for API calls
  readonly itemsPayload = computed<LineItemPayload[]>(() => [
    ...this.medicines().map((m, i) => ({
      itemType:     'medicine' as const,
      refId:        m.id,
      sortOrder:    i + 1,
      dosage:       m.dosage       || undefined,
      frequency:    m.frequency    || undefined,
      duration:     m.duration     || undefined,
      quantity:     m.quantity     || undefined,
      instructions: m.instructions || undefined,
    })),
    ...this.procedures().map((p, i) => ({
      itemType:        'procedure' as const,
      refId:           p.id,
      sortOrder:       this.medicines().length + i + 1,
      procedureStatus: p.status,
      instructions:    p.defaultNotes || undefined,
    })),
  ]);

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    // Resolve context from @Input or from query params
    const qp = this.route.snapshot.queryParams;
    this.context = this.ctx ?? {
      appointmentId:    +qp['appointmentId'],
      patientId:        +qp['patientId'],
      svcId:             qp['svcId'],
      patientName:       qp['patientName'],
      appointmentLabel:  qp['label'],
    };

    this.form = this.fb.group({
      diagnosis:     ['', [Validators.maxLength(500)]],
      clinicalNotes: ['', [Validators.maxLength(5000)]],
    });

    this._loadDefaults();
  }

  // ── Private helpers ───────────────────────────────────────────
  private async _loadDefaults(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      const defaults = await this.master.getDefaults(this.context.svcId);

      this.medicines.set(defaults.medicines.map(m => ({
        ...m,
        dosage:       m.defaultDose || '',
        frequency:    '',
        duration:     m.defaultDays ? `${m.defaultDays} days` : '',
        quantity:     '',
        instructions: '',
      })));

      this.procedures.set(defaults.procedures.map(p => ({
        ...p,
        status: 'planned' as const,
      })));
    } catch {
      this.errorMsg.set('Failed to load prescription defaults. Please refresh.');
    } finally {
      this.loading.set(false);
    }
  }

  private async _saveOrUpdate(): Promise<boolean> {
    if (!this.form.valid) return false;
    this.saving.set(true);
    this.errorMsg.set(null);
    try {
      const payload = {
        patientId:     this.context.patientId,
        appointmentId: this.context.appointmentId,
        ...this.form.value,
        items: this.itemsPayload(),
      };
      if (this.savedId()) {
        await this.rxSvc.update(this.savedId()!, payload);
      } else {
        const res = await this.rxSvc.create(payload);
        this.savedId.set(res.id);
        this.savedRxNo.set(res.prescriptionNo);
      }
      return true;
    } catch (e: any) {
      this.errorMsg.set(e?.error?.message ?? 'Save failed — please try again.');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  // ── Medicine management ───────────────────────────────────────
  addMedicine(med: RxMedicine): void {
    if (this.medicines().some(m => m.id === med.id)) return;
    this.medicines.update(list => [...list, {
      ...med,
      dosage:       med.defaultDose || '',
      frequency:    '',
      duration:     med.defaultDays ? `${med.defaultDays} days` : '',
      quantity:     '',
      instructions: '',
    }]);
  }

  removeMedicine(id: number): void {
    this.medicines.update(list => list.filter(m => m.id !== id));
  }

  updateMedicineField(id: number, field: keyof MedFormItem, value: string): void {
    this.medicines.update(list =>
      list.map(m => m.id === id ? { ...m, [field]: value } : m)
    );
  }

  // ── Procedure management ──────────────────────────────────────
  addProcedure(proc: RxProcedure): void {
    if (this.procedures().some(p => p.id === proc.id)) return;
    this.procedures.update(list => [...list, { ...proc, status: 'planned' }]);
  }

  setProcedureStatus(id: number, status: 'planned' | 'done' | 'skipped'): void {
    this.procedures.update(list =>
      list.map(p => p.id === id ? { ...p, status } : p)
    );
  }

  // ── Actions ───────────────────────────────────────────────────
  async saveDraft(): Promise<void> {
    await this._saveOrUpdate();
  }

  async generatePdf(): Promise<void> {
    const saved = await this._saveOrUpdate();
    if (!saved || !this.savedId()) return;

    this.generating.set(true);
    this.errorMsg.set(null);
    try {
      await this.rxSvc.generatePdf(this.savedId()!);
      const url = await this.rxSvc.pollUntilPdfReady(this.savedId()!);
      this.pdfUrl.set(url);
      this.successMsg.set(`PDF generated · ${this.savedRxNo()}`);
    } catch (e: any) {
      this.errorMsg.set('PDF generation failed. Retry using the button.');
    } finally {
      this.generating.set(false);
    }
  }

  async saveAndSendWA(): Promise<void> {
    await this.generatePdf();
    if (!this.pdfUrl() || !this.savedId()) return;
    try {
      await this.rxSvc.sendOnWA(this.savedId()!);
      this.waSent.set(true);
      this.successMsg.set(`Prescription ${this.savedRxNo()} sent to patient on WhatsApp.`);
    } catch {
      this.errorMsg.set('WhatsApp send failed. Try again using Resend WA button.');
    }
  }

  togglePreview(): void {
    this.showPreview.update(v => !v);
  }
}
```

### `prescription-form/prescription-form.component.html`

```html
<!-- Loading state -->
<div class="rx-loading" *ngIf="loading()">
  <span class="spinner"></span> Loading defaults for {{ context?.svcId }}...
</div>

<div class="rx-form" *ngIf="!loading()">

  <!-- Header -->
  <div class="rx-form-header">
    <div class="rx-form-title">
      New Prescription
      <span class="rx-label">{{ context.patientName }}</span>
      <span class="rx-sep">·</span>
      <span class="rx-label">{{ context.appointmentLabel }}</span>
    </div>
    <div class="rx-no" *ngIf="savedRxNo()">{{ savedRxNo() }}</div>
  </div>

  <!-- Success banner -->
  <div class="rx-banner success" *ngIf="successMsg()">
    ✅ {{ successMsg() }}
    <a [href]="pdfUrl()" target="_blank" *ngIf="pdfUrl()">View PDF ↗</a>
  </div>

  <!-- Error banner -->
  <div class="rx-banner error" *ngIf="errorMsg()">
    ⚠ {{ errorMsg() }}
  </div>

  <!-- Top fields -->
  <div class="rx-fields" [formGroup]="form">
    <div class="rx-field">
      <label>Diagnosis</label>
      <input formControlName="diagnosis"
             placeholder="e.g. Pulpitis — irreversible, tooth #36">
      <div class="field-error"
           *ngIf="form.get('diagnosis')?.invalid && form.get('diagnosis')?.touched">
        Maximum 500 characters
      </div>
    </div>
    <div class="rx-field">
      <label>Procedure</label>
      <input [value]="context.appointmentLabel" disabled>
    </div>
  </div>

  <!-- Two-column: medicines + procedures -->
  <div class="rx-columns">

    <!-- Left: Medicines -->
    <div class="rx-col">
      <div class="rx-col-header">
        💊 Medicines
        <span class="rx-col-count">({{ medicines().length }})</span>
      </div>

      <app-medicine-line-item
        *ngFor="let med of medicines(); trackBy: trackMedById"
        [item]="med"
        (fieldChange)="updateMedicineField(med.id, $event.field, $event.value)"
        (remove)="removeMedicine(med.id)">
      </app-medicine-line-item>

      <app-medicine-search
        (medicineSelected)="addMedicine($event)">
      </app-medicine-search>
    </div>

    <!-- Right: Procedures -->
    <div class="rx-col">
      <div class="rx-col-header">
        🔬 Procedures
        <span class="rx-col-count">({{ procedures().length }})</span>
      </div>

      <div class="proc-row" *ngFor="let proc of procedures(); trackBy: trackProcById">
        <div class="proc-name">{{ proc.procedureName }}</div>
        <div class="proc-status" *ngIf="proc.procedureStep">
          Step {{ proc.procedureStep }}
        </div>
        <div class="proc-btns">
          <button [class.active]="proc.status === 'done'"
                  (click)="setProcedureStatus(proc.id, 'done')">Done</button>
          <button [class.active]="proc.status === 'planned'"
                  (click)="setProcedureStatus(proc.id, 'planned')">Planned</button>
          <button [class.active]="proc.status === 'skipped'"
                  (click)="setProcedureStatus(proc.id, 'skipped')">Skip</button>
        </div>
      </div>

      <app-procedure-picker
        [svcId]="context.svcId"
        [excludeIds]="procedures() | map:'id'"
        (procedureSelected)="addProcedure($event)">
      </app-procedure-picker>
    </div>
  </div>

  <!-- Post-care notes -->
  <div class="rx-notes" [formGroup]="form">
    <label>Post-care instructions</label>
    <textarea formControlName="clinicalNotes"
              rows="3"
              placeholder="Enter special instructions or post-care notes...">
    </textarea>
  </div>

  <!-- Preview toggle -->
  <button class="btn-link" (click)="togglePreview()">
    {{ showPreview() ? '▲ Hide preview' : '▼ Preview prescription' }}
  </button>

  <app-prescription-preview
    *ngIf="showPreview()"
    [medicines]="medicines()"
    [procedures]="procedures()"
    [diagnosis]="form.get('diagnosis')?.value"
    [clinicalNotes]="form.get('clinicalNotes')?.value"
    [patientName]="context.patientName"
    [rxNo]="savedRxNo()">
  </app-prescription-preview>

  <!-- Action buttons -->
  <div class="rx-actions">
    <button class="btn btn-ghost"
            [disabled]="saving() || generating()"
            (click)="saveDraft()">
      {{ saving() ? 'Saving...' : 'Save Draft' }}
    </button>

    <button class="btn btn-success"
            [disabled]="generating() || saving()"
            (click)="saveAndSendWA()">
      {{ generating() ? 'Generating PDF...' : 'Save & Send on WhatsApp' }}
    </button>

    <button class="btn btn-primary"
            [disabled]="generating() || saving()"
            (click)="generatePdf()">
      Generate PDF
    </button>
  </div>

</div>
```

### `prescription-form/prescription-form.component.scss`

```scss
.rx-form {
  padding: 20px;
  background: #F8F7F4;
  border-radius: 12px;

  &-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #E2E8F0;
  }

  &-title { font-size: 14px; font-weight: 600; color: #1E293B; }
}

.rx-label  { color: #64748B; font-weight: 400; }
.rx-sep    { color: #CBD5E1; }
.rx-no     { font-family: 'DM Mono', monospace; font-size: 12px; color: #0D7A5F;
              background: #EBF9F6; padding: 3px 9px; border-radius: 6px; margin-left: auto; }

.rx-banner {
  padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; font-weight: 500;
  display: flex; align-items: center; gap: 10px;
  &.success { background: #D1FAE5; color: #065F46; }
  &.error   { background: #FEE2E2; color: #DC2626; }
  a { color: inherit; text-decoration: underline; margin-left: auto; }
}

.rx-fields {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;
  label  { display: block; font-size: 10.5px; font-weight: 600; color: #475569; margin-bottom: 4px; }
  input  { width: 100%; padding: 8px 10px; border: 1.5px solid #E2E8F0;
           border-radius: 8px; font-size: 13px; &:focus { border-color: #12A07C; outline: none; } }
}

.rx-columns {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;
}

.rx-col {
  background: #fff; border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden;
  &-header { padding: 9px 12px; background: #F1F5F9; font-size: 11px;
             font-weight: 600; color: #334155; display: flex; align-items: center; gap: 6px; }
  &-count  { color: #94A3B8; font-weight: 400; }
}

.proc-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 12px; border-bottom: 1px solid #F1F5F9; flex-wrap: wrap;
  &:last-child { border: none; }
}
.proc-name   { flex: 1; font-size: 12px; color: #1E293B; font-weight: 500; }
.proc-status { font-size: 10px; color: #94A3B8; }
.proc-btns   { display: flex; gap: 4px;
  button {
    padding: 3px 8px; font-size: 10px; border-radius: 6px;
    border: 1px solid #E2E8F0; background: #fff; cursor: pointer; color: #64748B;
    &.active { background: #0D7A5F; color: #fff; border-color: #0D7A5F; }
  }
}

.rx-notes {
  margin-bottom: 12px;
  label    { display: block; font-size: 10.5px; font-weight: 600; color: #475569; margin-bottom: 4px; }
  textarea { width: 100%; border: 1.5px solid #E2E8F0; border-radius: 8px;
             padding: 8px 10px; font-size: 13px; font-family: inherit; resize: vertical;
             &:focus { border-color: #12A07C; outline: none; } }
}

.btn-link { background: none; border: none; color: #0D7A5F; font-size: 12px;
            cursor: pointer; padding: 4px 0; margin-bottom: 10px; }

.rx-actions {
  display: flex; gap: 10px; padding-top: 14px; border-top: 1px solid #E2E8F0;
}

.btn {
  padding: 9px 18px; border: none; border-radius: 8px; font-size: 13px;
  font-weight: 600; cursor: pointer; font-family: inherit;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &-primary  { background: #0D7A5F; color: #fff; }
  &-success  { background: #10B981; color: #fff; }
  &-ghost    { background: #fff; color: #334155; border: 1px solid #E2E8F0; }
}

.rx-loading { padding: 32px; text-align: center; color: #64748B; font-size: 13px;
              display: flex; align-items: center; justify-content: center; gap: 8px; }
.spinner { width: 16px; height: 16px; border: 2px solid #E2E8F0;
           border-top-color: #0D7A5F; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
```

---

## 20. Frontend — MedicineSearchComponent

### `medicine-search/medicine-search.component.ts`

```typescript
import {
  Component, Output, EventEmitter, inject,
  signal, ChangeDetectionStrategy,
} from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, switchMap, from, of } from 'rxjs';
import { RxMasterService } from '../services/rx-master.service';
import { RxMedicine } from '../interfaces/rx.interfaces';

@Component({
  selector:        'app-medicine-search',
  templateUrl:     './medicine-search.component.html',
  styleUrls:       ['./medicine-search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicineSearchComponent {
  @Output() medicineSelected = new EventEmitter<RxMedicine>();

  private master   = inject(RxMasterService);
  private input$   = new Subject<string>();

  query       = signal('');
  results     = signal<RxMedicine[]>([]);
  showResults = signal(false);
  searching   = signal(false);

  constructor() {
    this.input$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < 2) { this.results.set([]); return of([]); }
        this.searching.set(true);
        return from(this.master.getMedicines(q));
      }),
    ).subscribe({
      next:  res  => { this.results.set(res); this.searching.set(false); },
      error: ()   => { this.searching.set(false); },
    });
  }

  onInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    this.query.set(val);
    this.input$.next(val);
    this.showResults.set(true);
  }

  onFocus(): void { this.showResults.set(true); }
  onBlur():  void { setTimeout(() => this.showResults.set(false), 180); }

  select(med: RxMedicine): void {
    this.medicineSelected.emit(med);
    this.query.set('');
    this.results.set([]);
    this.showResults.set(false);
  }

  trackById(_: number, item: RxMedicine): number { return item.id; }
}
```

### `medicine-search/medicine-search.component.html`

```html
<div class="med-search">
  <input
    class="med-search-input"
    type="text"
    [value]="query()"
    placeholder="+ Search and add medicine..."
    (input)="onInput($event)"
    (focus)="onFocus()"
    (blur)="onBlur()">

  <div class="search-spinner" *ngIf="searching()">⟳</div>

  <ul class="search-results" *ngIf="showResults() && results().length">
    <li *ngFor="let med of results(); trackBy: trackById"
        class="search-result-item"
        (mousedown)="select(med)">
      <span class="result-name">{{ med.genericName }}</span>
      <span class="result-meta">{{ med.strength }} · {{ med.dosageForm }}</span>
      <span class="result-brand" *ngIf="med.brandName">{{ med.brandName }}</span>
    </li>
  </ul>

  <div class="search-empty"
       *ngIf="showResults() && !results().length && query().length >= 2 && !searching()">
    No medicines found for "{{ query() }}"
  </div>
</div>
```

### `medicine-search/medicine-search.component.scss`

```scss
.med-search {
  position: relative; padding: 8px 12px;

  &-input {
    width: 100%; padding: 6px 10px; border: 1.5px dashed #3DBFA0;
    border-radius: 7px; font-size: 12px; background: #EBF9F6;
    color: #0D7A5F; outline: none;
    &::placeholder { color: #3DBFA0; }
    &:focus { border-style: solid; background: #fff; }
  }
}

.search-spinner {
  position: absolute; right: 20px; top: 50%; transform: translateY(-50%);
  font-size: 14px; color: #3DBFA0; animation: spin .6s linear infinite;
}

.search-results {
  position: absolute; left: 0; right: 0; z-index: 100;
  background: #fff; border: 1px solid #E2E8F0; border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,.1); list-style: none;
  max-height: 220px; overflow-y: auto; margin: 0; padding: 4px 0;
}

.search-result-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; cursor: pointer; transition: background .1s;
  &:hover { background: #EBF9F6; }
}

.result-name  { font-size: 12px; font-weight: 600; color: #1E293B; flex: 1; }
.result-meta  { font-size: 10.5px; color: #64748B; }
.result-brand { font-size: 10px; color: #94A3B8; font-style: italic; }

.search-empty {
  padding: 8px 12px; font-size: 12px; color: #94A3B8; font-style: italic;
}

@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }
```

---

## 21. Frontend — MedicineLineItemComponent

### `medicine-line-item/medicine-line-item.component.ts`

```typescript
import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MedFormItem } from '../interfaces/rx.interfaces';

export interface FieldChangeEvent {
  field: keyof MedFormItem;
  value: string;
}

@Component({
  selector:        'app-medicine-line-item',
  templateUrl:     './medicine-line-item.component.html',
  styleUrls:       ['./medicine-line-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicineLineItemComponent {
  @Input()  item!:        MedFormItem;
  @Output() fieldChange = new EventEmitter<FieldChangeEvent>();
  @Output() remove      = new EventEmitter<void>();

  onField(field: keyof MedFormItem, e: Event): void {
    this.fieldChange.emit({ field, value: (e.target as HTMLInputElement).value });
  }
}
```

### `medicine-line-item/medicine-line-item.component.html`

```html
<div class="med-item">
  <div class="med-item-header">
    <div class="med-name">
      {{ item.genericName }}
      <span class="med-strength">{{ item.strength }}</span>
    </div>
    <button class="med-remove" (click)="remove.emit()" aria-label="Remove">×</button>
  </div>

  <div class="med-item-fields">
    <div class="med-field">
      <label>Dosage</label>
      <input [value]="item.dosage"
             placeholder="e.g. 1-0-1"
             (input)="onField('dosage', $event)">
    </div>
    <div class="med-field">
      <label>Frequency</label>
      <input [value]="item.frequency"
             placeholder="e.g. After food"
             (input)="onField('frequency', $event)">
    </div>
    <div class="med-field">
      <label>Duration</label>
      <input [value]="item.duration"
             placeholder="e.g. 5 days"
             (input)="onField('duration', $event)">
    </div>
    <div class="med-field">
      <label>Qty</label>
      <input [value]="item.quantity"
             placeholder="e.g. 10 tabs"
             (input)="onField('quantity', $event)">
    </div>
  </div>
</div>
```

### `medicine-line-item/medicine-line-item.component.scss`

```scss
.med-item {
  border-bottom: 1px solid #F1F5F9; padding: 8px 12px;
  &:last-of-type { border-bottom: none; }

  &-header {
    display: flex; align-items: center; gap: 8px; margin-bottom: 5px;
  }

  &-fields {
    display: grid; grid-template-columns: 2fr 2fr 1.5fr 1.5fr; gap: 6px;
  }
}

.med-name     { flex: 1; font-size: 12px; font-weight: 600; color: #1E293B; }
.med-strength { font-size: 10.5px; color: #64748B; font-weight: 400; margin-left: 4px; }
.med-remove   { background: none; border: none; color: #EF4444; font-size: 16px;
               cursor: pointer; padding: 0 4px; opacity: 0.6; &:hover { opacity: 1; } }

.med-field {
  label { display: block; font-size: 9.5px; color: #94A3B8; margin-bottom: 2px; }
  input { width: 100%; padding: 4px 7px; border: 1px solid #E2E8F0;
         border-radius: 5px; font-size: 11px; color: #1E293B;
         &:focus { border-color: #12A07C; outline: none; } }
}
```

---

## 22. Frontend — ProcedurePickerComponent

### `procedure-picker/procedure-picker.component.ts`

```typescript
import {
  Component, Input, Output, EventEmitter, OnInit,
  inject, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { RxMasterService } from '../services/rx-master.service';
import { RxProcedure } from '../interfaces/rx.interfaces';

@Component({
  selector:        'app-procedure-picker',
  templateUrl:     './procedure-picker.component.html',
  styleUrls:       ['./procedure-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcedurePickerComponent implements OnInit {
  @Input()  svcId!:      string;
  @Input()  excludeIds:  number[] = [];
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
```

### `procedure-picker/procedure-picker.component.html`

```html
<div class="proc-picker">
  <button class="proc-picker-trigger" (click)="toggleOpen()">
    + Add procedure
  </button>

  <ul class="proc-picker-list" *ngIf="open() && available().length">
    <li *ngFor="let proc of available(); trackBy: trackById"
        class="proc-picker-item"
        (click)="select(proc)">
      <span *ngIf="proc.procedureStep" class="proc-step-badge">
        Step {{ proc.procedureStep }}
      </span>
      {{ proc.procedureName }}
    </li>
  </ul>

  <div class="proc-picker-empty"
       *ngIf="open() && !available().length">
    All procedures already added
  </div>
</div>
```

### `procedure-picker/procedure-picker.component.scss`

```scss
.proc-picker { position: relative; padding: 8px 12px; }

.proc-picker-trigger {
  background: none; border: 1.5px dashed #3DBFA0; border-radius: 7px;
  color: #0D7A5F; font-size: 11.5px; padding: 5px 10px; cursor: pointer; width: 100%;
  &:hover { background: #EBF9F6; }
}

.proc-picker-list {
  position: absolute; left: 8px; right: 8px; z-index: 100;
  background: #fff; border: 1px solid #E2E8F0; border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,.1); list-style: none; padding: 4px 0;
  max-height: 200px; overflow-y: auto;
}

.proc-picker-item {
  padding: 8px 12px; font-size: 12px; color: #1E293B;
  cursor: pointer; display: flex; align-items: center; gap: 7px;
  &:hover { background: #EBF9F6; color: #0D7A5F; }
}

.proc-step-badge {
  font-size: 9.5px; background: #EBF9F6; color: #0D7A5F;
  padding: 2px 6px; border-radius: 4px; font-weight: 600;
}

.proc-picker-empty { padding: 8px 12px; font-size: 12px; color: #94A3B8; font-style: italic; }
```

---

## 23. Frontend — PrescriptionPreviewComponent

### `prescription-preview/prescription-preview.component.ts`

```typescript
import {
  Component, Input, ChangeDetectionStrategy,
} from '@angular/core';
import { MedFormItem, ProcFormItem } from '../interfaces/rx.interfaces';

@Component({
  selector:        'app-prescription-preview',
  templateUrl:     './prescription-preview.component.html',
  styleUrls:       ['./prescription-preview.component.scss'],
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
```

### `prescription-preview/prescription-preview.component.html`

```html
<div class="rx-preview">
  <!-- Clinic header -->
  <div class="rx-preview-header">
    <div class="clinic-name">Sharayu Dental Clinic</div>
    <div class="clinic-meta">Karve Road, Pune 411004 · +91 98765 43210</div>
  </div>

  <!-- Patient strip -->
  <div class="rx-patient-strip">
    <span>Patient: <strong>{{ patientName }}</strong></span>
    <span>Date: {{ today }}</span>
    <span class="rx-no-badge" *ngIf="rxNo">{{ rxNo }}</span>
  </div>

  <!-- Diagnosis -->
  <div class="rx-diagnosis" *ngIf="diagnosis">
    <strong>Diagnosis:</strong> {{ diagnosis }}
  </div>

  <!-- Rx symbol + medicines -->
  <div class="rx-symbol">℞</div>
  <div class="rx-medicine-list">
    <div class="rx-med-item" *ngFor="let m of medicines; let i = index">
      <span class="rx-med-num">{{ i + 1 }}.</span>
      <span class="rx-med-name">{{ m.genericName }} {{ m.strength }}</span>
      <span class="rx-med-dose" *ngIf="m.dosage">{{ m.dosage }}</span>
      <span class="rx-med-dur"  *ngIf="m.duration">— {{ m.duration }}</span>
    </div>
  </div>

  <!-- Procedures -->
  <div class="rx-proc-section" *ngIf="procedures.length">
    <div class="rx-proc-title">Procedures:</div>
    <div class="rx-proc-item" *ngFor="let p of procedures; let i = index">
      {{ i + 1 }}. {{ p.procedureName }}
      <span class="proc-status-tag" [class]="p.status">{{ p.status }}</span>
    </div>
  </div>

  <!-- Instructions -->
  <div class="rx-inst" *ngIf="clinicalNotes">
    <strong>Instructions:</strong> {{ clinicalNotes }}
  </div>

  <div class="rx-footer">
    Generated by DentaFlow · dentaflow.in
  </div>
</div>
```

### `prescription-preview/prescription-preview.component.scss`

```scss
.rx-preview {
  border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px;
  background: #fff; font-size: 11.5px; margin-top: 12px;
  font-family: 'Georgia', serif;
}

.rx-preview-header { border-bottom: 1px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 8px; }
.clinic-name { font-size: 15px; font-weight: 700; color: #0D7A5F; }
.clinic-meta { font-size: 10px; color: #64748B; margin-top: 2px; }

.rx-patient-strip {
  display: flex; gap: 16px; align-items: center; font-size: 10.5px; color: #334155;
  border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-bottom: 8px;
}
.rx-no-badge { margin-left: auto; font-family: monospace; font-size: 10px;
               background: #EBF9F6; color: #0D7A5F; padding: 2px 7px; border-radius: 4px; }

.rx-diagnosis { font-size: 10.5px; color: #334155; margin-bottom: 8px; }

.rx-symbol { font-size: 28px; color: #0D7A5F; font-weight: 700; margin-bottom: 6px; }

.rx-med-item {
  display: flex; align-items: baseline; gap: 8px; padding: 3px 0;
}
.rx-med-num  { font-size: 10px; color: #94A3B8; width: 16px; }
.rx-med-name { font-weight: 600; color: #1E293B; }
.rx-med-dose { color: #0D7A5F; font-size: 10.5px; }
.rx-med-dur  { color: #64748B; font-size: 10px; }

.rx-proc-section { margin-top: 10px; border-top: 1px solid #E2E8F0; padding-top: 8px; }
.rx-proc-title { font-weight: 600; color: #334155; margin-bottom: 4px; }
.rx-proc-item  { display: flex; align-items: center; gap: 8px; font-size: 10.5px; padding: 2px 0; }

.proc-status-tag {
  font-size: 9px; padding: 1px 5px; border-radius: 4px; font-weight: 600;
  &.done    { background: #D1FAE5; color: #065F46; }
  &.planned { background: #EBF9F6; color: #0D7A5F; }
  &.skipped { background: #F1F5F9; color: #94A3B8; }
}

.rx-inst   { margin-top: 10px; font-size: 10.5px; color: #475569;
             border-top: 1px solid #E2E8F0; padding-top: 8px; }
.rx-footer { margin-top: 14px; font-size: 9px; color: #94A3B8; text-align: center; }
```

---

## 24. Frontend — RxHistoryTabComponent

### `rx-history-tab/rx-history-tab.component.ts`

```typescript
import {
  Component, Input, OnInit, inject,
  signal, ChangeDetectionStrategy,
} from '@angular/core';
import { PrescriptionService } from '../services/prescription.service';
import { RxSummary } from '../interfaces/rx.interfaces';

@Component({
  selector:        'app-rx-history-tab',
  templateUrl:     './rx-history-tab.component.html',
  styleUrls:       ['./rx-history-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RxHistoryTabComponent implements OnInit {
  @Input() patientId!: number;

  private rxSvc = inject(PrescriptionService);

  loading       = signal(true);
  prescriptions = signal<RxSummary[]>([]);
  total         = signal(0);
  page          = signal(1);
  resendingId   = signal<number | null>(null);
  errorMsg      = signal<string | null>(null);

  ngOnInit(): void { this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.rxSvc.listForPatient(
        this.patientId, this.page(), 10
      );
      this.prescriptions.set(res.data);
      this.total.set(res.total);
    } catch {
      this.errorMsg.set('Failed to load prescriptions.');
    } finally {
      this.loading.set(false);
    }
  }

  async downloadPdf(rxId: number): Promise<void> {
    try {
      const { url } = await this.rxSvc.getPdfUrl(rxId);
      if (url) window.open(url, '_blank');
    } catch {
      this.errorMsg.set('Could not generate download link.');
    }
  }

  async resendWA(rxId: number): Promise<void> {
    this.resendingId.set(rxId);
    try {
      await this.rxSvc.sendOnWA(rxId);
      await this.load();
    } catch {
      this.errorMsg.set('WhatsApp resend failed. Please try again.');
    } finally {
      this.resendingId.set(null);
    }
  }

  changePage(p: number): void {
    this.page.set(p);
    this.load();
  }

  trackById(_: number, item: RxSummary): number { return item.id; }
}
```

### `rx-history-tab/rx-history-tab.component.html`

```html
<div class="rx-history">

  <div class="rx-history-error" *ngIf="errorMsg()">⚠ {{ errorMsg() }}</div>

  <div class="rx-history-loading" *ngIf="loading()">Loading prescriptions...</div>

  <div class="rx-history-empty"
       *ngIf="!loading() && !prescriptions().length">
    No prescriptions yet for this patient.
  </div>

  <div class="rx-item"
       *ngFor="let rx of prescriptions(); trackBy: trackById">

    <div class="rx-item-left">
      <div class="rx-item-no">{{ rx.prescriptionNo }}</div>
      <div class="rx-item-diagnosis">{{ rx.diagnosis ?? 'No diagnosis recorded' }}</div>
      <div class="rx-item-date">{{ rx.createdAt | date:'dd MMM yyyy' }}</div>
    </div>

    <div class="rx-item-right">
      <!-- Status badges -->
      <span class="rx-badge wa"    *ngIf="rx.waSent">✓ Sent on WA</span>
      <span class="rx-badge pdf"   *ngIf="rx.pdfGenerated && !rx.waSent">PDF ready</span>
      <span class="rx-badge draft" *ngIf="!rx.pdfGenerated">Draft</span>

      <!-- Actions -->
      <button class="rx-action-btn"
              *ngIf="rx.pdfGenerated"
              (click)="downloadPdf(rx.id)">
        ↓ PDF
      </button>
      <button class="rx-action-btn resend"
              *ngIf="rx.pdfGenerated"
              [disabled]="resendingId() === rx.id"
              (click)="resendWA(rx.id)">
        {{ resendingId() === rx.id ? 'Sending...' : '↺ WA' }}
      </button>
    </div>

  </div>

  <!-- Pagination -->
  <div class="rx-pagination" *ngIf="total() > 10">
    <button [disabled]="page() === 1" (click)="changePage(page() - 1)">← Prev</button>
    <span>Page {{ page() }}</span>
    <button [disabled]="page() * 10 >= total()" (click)="changePage(page() + 1)">Next →</button>
  </div>

</div>
```

### `rx-history-tab/rx-history-tab.component.scss`

```scss
.rx-history { padding: 0; }

.rx-history-error   { padding: 10px; background: #FEE2E2; color: #DC2626;
                      border-radius: 7px; margin: 10px; font-size: 12px; }
.rx-history-loading { padding: 20px; text-align: center; color: #64748B; font-size: 13px; }
.rx-history-empty   { padding: 20px; text-align: center; color: #94A3B8; font-size: 13px;
                      font-style: italic; }

.rx-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-bottom: 1px solid #F1F5F9;
  &:last-child { border: none; }
  &:hover { background: #F8F7F4; }
}

.rx-item-left  { flex: 1; min-width: 0; }
.rx-item-no    { font-family: 'DM Mono', monospace; font-size: 11px;
                 color: #0D7A5F; font-weight: 500; }
.rx-item-diagnosis { font-size: 12px; color: #334155; margin-top: 2px;
                     white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rx-item-date  { font-size: 10.5px; color: #94A3B8; margin-top: 2px; }

.rx-item-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.rx-badge {
  font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 100px;
  &.wa    { background: #D1FAE5; color: #065F46; }
  &.pdf   { background: #FEF3C7; color: #92400E; }
  &.draft { background: #F1F5F9; color: #64748B; }
}

.rx-action-btn {
  padding: 4px 9px; font-size: 10.5px; border-radius: 6px;
  border: 1px solid #E2E8F0; background: #fff; cursor: pointer; color: #334155;
  &:hover { border-color: #0D7A5F; color: #0D7A5F; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &.resend:hover { border-color: #25D366; color: #25D366; }
}

.rx-pagination {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 12px; font-size: 12px; color: #64748B;
  button { padding: 4px 10px; border: 1px solid #E2E8F0; border-radius: 6px;
           background: #fff; cursor: pointer; &:disabled { opacity: 0.4; } }
}
```

---

## 25. Frontend — AppointmentDetail Integration

### `appointment-detail/appointment-detail.component.ts` — add Rx button

```typescript
import { Router } from '@angular/router';
import { PrescriptionContext } from '../rx/interfaces/rx.interfaces';

// Inject Router
private router = inject(Router);

openPrescription(): void {
  const ctx: PrescriptionContext = {
    appointmentId:    this.appointment().id,
    patientId:        this.appointment().patientId,
    svcId:            this.appointment().svcId,
    patientName:      this.appointment().patient.name,
    appointmentLabel: this.appointment().serviceLabel,
  };

  this.router.navigate(['/rx/new'], {
    queryParams: {
      appointmentId:    ctx.appointmentId,
      patientId:        ctx.patientId,
      svcId:            ctx.svcId,
      patientName:      ctx.patientName,
      label:            ctx.appointmentLabel,
    },
  });
}
```

### `appointment-detail/appointment-detail.component.html` — add button

```html
<!-- Inside the modal-actions strip, alongside existing buttons -->
<button class="act-btn act-ghost" (click)="openPrescription()">
  💊 Prescription
</button>
```

### In `patient-record.component.html` — add Rx history tab

```html
<!-- In the tabs list -->
<div class="pt-tab" [class.on]="activeTab() === 'prescriptions'"
     (click)="activeTab.set('prescriptions')">
  Prescriptions
</div>

<!-- In the tab panel section -->
<app-rx-history-tab
  *ngIf="activeTab() === 'prescriptions'"
  [patientId]="patient().id">
</app-rx-history-tab>
```

Import `RxModule` in `PatientModule` (or wherever `patient-record` lives):

```typescript
// patient/patient.module.ts
import { RxModule } from '../rx/rx.module';

@NgModule({
  imports: [..., RxModule],
})
export class PatientModule {}
```

---

## 26. Implementation Checklist

### Database — run in order

- [ ] `npm run migrate:rx:up` — runs all 5 migrations via Umzug
- [ ] Verify: `SequelizeMeta` table shows 5 new entries
- [ ] `npm run seed:rx` — seeds 14+ medicines, 17+ procedures, all service defaults
- [ ] Verify: `SELECT COUNT(*) FROM rx_medicines;` → >= 14
- [ ] Verify: `SELECT COUNT(*) FROM rx_procedures;` → >= 17
- [ ] Verify: `SELECT * FROM rx_service_defaults WHERE svc_id = 'SVC-03';` → 5 rows

### Backend

- [ ] All 6 Sequelize models created and associated in `src/models/index.js`
- [ ] `rxRepository.js` — all query functions, uses `sequelize.query` for raw `FOR UPDATE`
- [ ] `rxService.js` — Redis cache wrapping master queries, `sequelize.transaction()` for Rx#
- [ ] `rxController.js` + `rxAdminController.js` — thin controllers, Zod validation
- [ ] `rxRoutes.js` — 13 routes registered, `app.use('/api/rx', ...)` in `server.js`
- [ ] `pdf-worker.js` — `generate_rx_pdf` processor with field enrichment
- [ ] `rxPdfBuilder.js` — all 7 render functions
- [ ] `wa-worker.js` — `prescription_ready` case + `markWaSent`
- [ ] Meta WA template `prescription_ready` submitted for approval (3-7 days)

**Test scenarios:**

- [ ] `POST /api/rx/prescriptions` → response has `prescriptionNo: "DRX-2026-0001"`
- [ ] Run twice concurrently → two unique Rx# (tests `FOR UPDATE` lock)
- [ ] `GET /api/rx/master/defaults?svc_id=SVC-03` → returns amoxicillin + 4 others
- [ ] `POST /api/rx/prescriptions/:id/generate` → Bull job created
- [ ] PDF appears in S3 under `prescriptions/{patientId}/{rxNo}.pdf`
- [ ] Paediatric patient (SVC-07) → WA routed to `parent_phone`
- [ ] `GET /api/rx/prescriptions/:id/pdf` returns 15-min URL

### Frontend

- [ ] `rx.module.ts` declared, lazy-loaded in `app-routing.module.ts`
- [ ] `rx-routing.module.ts` — `/rx/new` and `/rx/:id/edit`
- [ ] `rx.interfaces.ts` — all interfaces defined
- [ ] `RxMasterService` — `getDefaults()`, `getMedicines()` with in-memory cache
- [ ] `PrescriptionService` — `pollUntilPdfReady()` with `interval + takeWhile`
- [ ] `PrescriptionFormComponent` — Signals state, computed `itemsPayload`, all 4 actions
- [ ] `MedicineSearchComponent` — `debounceTime(250)` + `Subject` + blur-delay 180ms
- [ ] `MedicineLineItemComponent` — `@Output() fieldChange`, `@Output() remove`
- [ ] `ProcedurePickerComponent` — `excludeIds` filtering, toggle open/close
- [ ] `PrescriptionPreviewComponent` — read-only HTML preview before PDF generation
- [ ] `RxHistoryTabComponent` — pagination, download PDF, resend WA
- [ ] `AppointmentDetailComponent` — `openPrescription()` navigates with query params
- [ ] `PatientModule` imports `RxModule` for `app-rx-history-tab` selector to resolve

**Test scenarios:**

- [ ] Open Rx for SVC-03 appointment → Amoxicillin + Ibuprofen + Pantoprazole pre-filled
- [ ] Search "metron" → Metronidazole appears in dropdown → click adds to form
- [ ] Remove a medicine → immediately removed from `medicines()` signal
- [ ] Mark procedure as "done" → status button highlights, payload reflects `done`
- [ ] Click "Save Draft" → Rx# appears in header, no PDF generated yet
- [ ] Click "Generate PDF" → spinner → resolves → "View PDF ↗" link appears
- [ ] Click "Save & Send WA" → PDF generated + patient receives WA within 10s
- [ ] Patient record Prescriptions tab → history loads, Download PDF opens new tab
- [ ] Resend WA button on past prescription → `wa_sent` updates in DB + UI

### Estimated build time

| Task | Hours |
|---|---|
| Umzug setup + 5 migrations | 2h |
| Sequelize models + associations | 2h |
| Master data seeder | 1.5h |
| rxRepository | 2h |
| rxService (cache + transaction) | 3h |
| rxController + rxAdminController | 2h |
| rxRoutes + server.js registration | 0.5h |
| rxPdfBuilder (7 render functions) | 4h |
| pdf-worker + wa-worker additions | 2h |
| rx.module + routing + interfaces | 1h |
| RxMasterService + PrescriptionService | 3h |
| PrescriptionFormComponent (.ts + .html + .scss) | 5h |
| MedicineSearchComponent | 2h |
| MedicineLineItemComponent | 1.5h |
| ProcedurePickerComponent | 1.5h |
| PrescriptionPreviewComponent | 2h |
| RxHistoryTabComponent | 2h |
| AppointmentDetail + PatientRecord integration | 1h |
| **Total** | **~38h (~5 working days)** |

---

*DentaFlow · Prescription Model Implementation Guide · v2.0 (Sequelize + Umzug) · May 2026*  
*Akib Tamboli — Solutions Architect · Confidential — internal document*