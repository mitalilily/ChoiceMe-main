// utils/labelPreferencesMapper.ts

import type { LabelPreferences } from '../api/labelPreference.api'
import type { LabelSettingsForm } from '../components/settings/Label/LabelSettings'

export function mapApiToForm(prefs: LabelPreferences): LabelSettingsForm {
  return {
    orderInfo: prefs.order_info,
    shipperInfo: prefs.shipper_info,
    productInfo: prefs.product_info,
    charLimit: prefs.char_limit,
    maxItems: prefs.max_items,
    noteEnabled: prefs.note_enabled === true,
    labelNote: prefs.label_note ?? '',
    printer: prefs.printer_type,
    labelSheetLayout: prefs.label_sheet_layout ?? 'a4_single',
  }
}

export function mapFormToApi(form: LabelSettingsForm): Partial<LabelPreferences> {
  return {
    order_info: form.orderInfo,
    shipper_info: form.shipperInfo,
    product_info: form.productInfo,
    char_limit: form.charLimit,
    max_items: form.maxItems,
    note_enabled: form.noteEnabled,
    label_note: form.labelNote,
    printer_type: form.printer,
    label_sheet_layout: form.labelSheetLayout,
  }
}
