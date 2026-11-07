/**
 * The dashboard's messages in English, one file per area (namespace dash.<area>),
 * so the areas can be translated side by side. src/i18n/request.ts adds them as `dash`.
 */
import common from './en/common.json'
import coupons from './en/coupons.json'
import leads from './en/leads.json'
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
import members from './en/members.json'
import admin from './en/admin.json'
import adminOrders from './en/adminOrders.json'
import adminActivity from './en/adminActivity.json'
import blog from './en/blog.json'
import customers from './en/customers.json'
import channels from './en/channels.json'

const dash = { common, coupons, customers, channels, leads, bookings, calendar, property, rooms, menu, money, reports, website, workspace, account, ui, billing, deletion, members, admin, adminOrders, adminActivity, blog }
export default dash
