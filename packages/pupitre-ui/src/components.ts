import { Builder } from './components/Builder.js'
import { BuilderItem } from './components/BuilderItem.js'
import { Step } from './components/Step.js'
import { Wizard } from './components/Wizard.js'
import { ActionBar } from './components/ActionBar.js'
import { Actions } from './components/Actions.js'
import { AuthShell } from './components/AuthShell.js'
import { BadgeEntry } from './components/BadgeEntry.js'
import { Checkbox } from './components/Checkbox.js'
import { CheckboxList } from './components/CheckboxList.js'
import { CodeEditor } from './components/CodeEditor.js'
import { ImportModal } from './components/ImportModal.js'
import { CodeEntry } from './components/CodeEntry.js'
import { Color } from './components/Color.js'
import { ColorEntry } from './components/ColorEntry.js'
import { ConfirmDialog } from './components/ConfirmDialog.js'
import { DataTable } from './components/DataTable.js'
import { RelationManager } from './components/RelationManager.js'
import { WidgetGrid } from './components/WidgetGrid.js'
import {
  WidgetStatsRenderer,
  WidgetChartRenderer,
  WidgetTableRenderer,
} from './components/WidgetCatalogAdapters.js'
import { Date } from './components/Date.js'
import { DateTime } from './components/DateTime.js'
import { Divider } from './components/Divider.js'
import { Fieldset } from './components/Fieldset.js'
import { FileUpload } from './components/FileUpload.js'
import { Form } from './components/Form.js'
import { Fragment } from './components/Fragment.js'
import { Grid } from './components/Grid.js'
import { Group } from './components/Group.js'
import { Hidden } from './components/Hidden.js'
import { Html } from './components/Html.js'
import { IconEntry } from './components/IconEntry.js'
import { ImageEntry } from './components/ImageEntry.js'
import { Infolist } from './components/Infolist.js'
import { KeyValue } from './components/KeyValue.js'
import { MarkdownEditor } from './components/MarkdownEditor.js'
import { KeyValueEntry } from './components/KeyValueEntry.js'
import { Modal } from './components/Modal.js'
import { NotFound } from './components/NotFound.js'
import { Number } from './components/Number.js'
import { Slider } from './components/Slider.js'
import { Placeholder } from './components/Placeholder.js'
import { Radio } from './components/Radio.js'
import { RepeatableEntry } from './components/RepeatableEntry.js'
import { Repeater } from './components/Repeater.js'
import { RepeaterItem } from './components/RepeaterItem.js'
import { RichEditor } from './components/RichEditor.js'
import { Section } from './components/Section.js'
import { Select } from './components/Select.js'
import { Shell } from './components/Shell.js'
import { Split } from './components/Split.js'
import { Tab } from './components/Tab.js'
import { Tabs } from './components/Tabs.js'
import { Tags } from './components/Tags.js'
import { Text } from './components/Text.js'
import { Textarea } from './components/Textarea.js'
import { TextEntry } from './components/TextEntry.js'
import { Time } from './components/Time.js'
import { Toaster } from './components/Toaster.js'
import { Toggle } from './components/Toggle.js'
import { ToggleButtons } from './components/ToggleButtons.js'
import { View } from './components/View.js'

export const components = {
  Text,
  Textarea,
  Number,
  Slider,
  Hidden,
  Select,
  Checkbox,
  CheckboxList,
  Radio,
  Toggle,
  ToggleButtons,
  Date,
  DateTime,
  Time,
  Color,
  Tags,
  KeyValue,
  MarkdownEditor,
  CodeEditor,
  RichEditor,
  FileUpload,
  Builder,
  BuilderItem,
  Repeater,
  RepeaterItem,
  Form,
  Grid,
  Section,
  Fieldset,
  Wizard,
  Step,
  Tabs,
  Tab,
  Group,
  Split,
  Placeholder,
  Html,
  Divider,
  Actions,
  AuthShell,
  View,
  Fragment,
  DataTable,
  'Widget.Stats': WidgetStatsRenderer,
  'Widget.Chart': WidgetChartRenderer,
  'Widget.Table': WidgetTableRenderer,
  RelationManager,
  ActionBar,
  Infolist,
  TextEntry,
  IconEntry,
  ImageEntry,
  ColorEntry,
  KeyValueEntry,
  RepeatableEntry,
  CodeEntry,
  BadgeEntry,
  Shell,
  Toaster,
  Modal,
  ConfirmDialog,
  NotFound,
  ImportModal,
  WidgetGrid,
} as const

export {
  RelationManager,
  Builder,
  BuilderItem,
  Step,
  Wizard,
  ActionBar,
  Actions,
  BadgeEntry,
  Checkbox,
  CheckboxList,
  CodeEditor,
  CodeEntry,
  Color,
  ColorEntry,
  ConfirmDialog,
  DataTable,
  Date,
  DateTime,
  Divider,
  Fieldset,
  FileUpload,
  Form,
  Fragment,
  Grid,
  Group,
  Hidden,
  Html,
  IconEntry,
  ImageEntry,
  Infolist,
  KeyValue,
  MarkdownEditor,
  KeyValueEntry,
  Modal,
  NotFound,
  Number,
  Placeholder,
  Radio,
  RepeatableEntry,
  Repeater,
  RepeaterItem,
  RichEditor,
  Section,
  Slider,
  Select,
  Shell,
  Split,
  Tab,
  Tabs,
  Tags,
  Text,
  Textarea,
  TextEntry,
  Time,
  Toaster,
  Toggle,
  ToggleButtons,
  View,
  ImportModal,
  WidgetGrid,
}
export {
  ViewRegistryProvider,
  ViewContext,
  ViewRegistryProvider as PupitreViewsProvider,
} from './components/View.js'
