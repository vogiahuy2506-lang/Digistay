/**
 * The dashboard's messages in Vietnamese, one file per area (namespace dash.<area>),
 * so the areas can be translated side by side. src/i18n/request.ts adds them as `dash`.
 */
import common from './vi/common.json'
import bookings from './vi/bookings.json'
import calendar from './vi/calendar.json'
import property from './vi/property.json'
import rooms from './vi/rooms.json'
import money from './vi/money.json'
import reports from './vi/reports.json'
import website from './vi/website.json'
import workspace from './vi/workspace.json'
import account from './vi/account.json'
import ui from './vi/ui.json'
import menu from './vi/menu.json'
import billing from './vi/billing.json'
import deletion from './vi/deletion.json'

const dash = { common, bookings, calendar, property, rooms, menu, money, reports, website, workspace, account, ui, billing, deletion }
export default dash
