/**
 * The dashboard's messages in English, one file per area (namespace dash.<area>),
 * so the areas can be translated side by side. src/i18n/request.ts adds them as `dash`.
 */
import common from './en/common.json'
import bookings from './en/bookings.json'
import calendar from './en/calendar.json'
import property from './en/property.json'
import rooms from './en/rooms.json'
import money from './en/money.json'
import reports from './en/reports.json'
import website from './en/website.json'
import workspace from './en/workspace.json'
import account from './en/account.json'
import ui from './en/ui.json'
import menu from './en/menu.json'
import billing from './en/billing.json'
import deletion from './en/deletion.json'

const dash = { common, bookings, calendar, property, rooms, menu, money, reports, website, workspace, account, ui, billing, deletion }
export default dash
