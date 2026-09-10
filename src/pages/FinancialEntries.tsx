import { useMemo, useState } from "react";
import { PanelRightClose, PanelRightOpen, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useEntriesStore, selectMonthEntries } from "@/store/useEntriesStore";
import { useCompanyStore } from "@/store/useCompanyStore";
import { buildStatement } from "@/lib/calculations";
import { evalAmountExpression, isMathExpression, formatMoney, vatOf, netOf } from "@/lib/format";
import { dayLabel } from "@/lib/export/report-scope";
import {
  monthEndLabel,
  MONTH_NAMES,
  SECTION_LABELS,
  ENTRY_SECTIONS,
  PAYMENT_MODES,
  quarterMonths,
  mergeCategories,
} from "@/lib/categories";
import { useAccountsStore } from "@/store/useAccountsStore";
import { useCategoriesStore } from "@/store/useCategoriesStore";
import { EntryGrid } from "@/components/entries/EntryGrid";
import { EntriesTable } from "@/components/entries/EntriesTable";
import { StatementReport } from "@/components/statement/StatementReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Entry, Section } from "@/types";

export function FinancialEntries() {
  const { date, year, month, searchQuery } = useAppStore();
  const { entries, addEntry, removeEntry, removeMany, editEntry } = useEntriesStore();
  const { company } = useCompanyStore();
  const { accounts } = useAccountsStore();
  const { custom } = useCategoriesStore();

  const [showPreview, setShowPreview] = useState(true);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Entry | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Edit dialog fields
  const [editSection, setEditSection] = useState<Section>("cos");
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editAccount, setEditAccount] = useState("");
  const [editPaymentMode, setEditPaymentMode] = useState("");
  const [editSupplier, setEditSupplier] = useState("");

  const openEdit = (e: Entry) => {
    setEditing(e);
    setEditSection(e.section === "income" ? "opex" : e.section);
    setEditDate(e.date);
    setEditCategory(e.category);
    setEditDescription(e.description);
    // The edit field works in the VAT-inclusive total (net + VAT); reopen the
    // receipt math if it was entered as a sum, otherwise the stored total.
    setEditAmount(e.breakdown || String(Math.round((e.amount + (e.vat ?? 0)) * 100) / 100));
    setEditAccount(e.account ?? "");
    setEditPaymentMode(e.paymentMode ?? "");
    setEditSupplier(e.supplier ?? "");
  };

  // Categories available for the currently chosen Type in the edit dialog.
  const editCategories = useMemo(
    () => mergeCategories(editSection, custom[editSection]),
    [editSection, custom]
  );

  // When the Type changes, keep the category valid for the new section.
  const onEditSectionChange = (value: Section) => {
    setEditSection(value);
    const list = mergeCategories(value, custom[value]);
    if (!list.includes(editCategory)) setEditCategory(list[0] ?? "");
  };

  // editTotal is the VAT-inclusive amount; net + VAT are extracted from it.
  const editTotal = evalAmountExpression(editAmount);
  const editVat = editTotal !== null && editTotal >= 0 ? vatOf(editTotal) : 0;
  const editNet = editTotal !== null && editTotal >= 0 ? netOf(editTotal) : 0;

  const saveEdit = async () => {
    if (!editing) return;
    const [y, m] = editDate.split("-").map(Number);
    if (!y || !m || editTotal === null || editTotal < 0) return;
    const expr = editAmount.replace(/\s+/g, "");
    const data = {
      date: editDate,
      year: y,
      month: m,
      category: editCategory,
      description: editDescription.trim(),
      amount: editNet,
      vat: editVat,
      account: editAccount,
      paymentMode: editPaymentMode,
      supplier: editSupplier.trim(),
      breakdown: isMathExpression(expr) ? expr : "",
    };
    if (editSection === editing.section) {
      await editEntry({ id: editing.id, section: editing.section, ...data });
    } else {
      // Type changed (Direct Cost <-> Operating Expenses). Sections live in
      // separate tables, so move the record: remove the old, create the new.
      await removeEntry(editing);
      await addEntry({ section: editSection, ...data });
    }
    setEditing(null);
  };

  // Filters
  const [filterSection, setFilterSection] = useState<"all" | Section>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [monthScope, setMonthScope] = useState<"day" | "month" | "year">("day");

  // Customer options aggregate accounts and any existing entry accounts
  const customerOptions = useMemo(() => {
    const set = new Set<string>(accounts.filter(Boolean));
    for (const e of entries) {
      const acc = (e.account ?? "").trim();
      if (acc) set.add(acc);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [accounts, entries]);

  const hasUnassignedCustomer = useMemo(
    () => entries.some((e) => !(e.account ?? "").trim()),
    [entries]
  );

  const scoped = useMemo(() => {
    // A search looks across the whole loaded year so results aren't hidden by the day scope
    let list =
      searchQuery.trim() !== ""
        ? entries
        : monthScope === "day"
          ? entries.filter((e) => e.date === date)
          : monthScope === "month"
            ? selectMonthEntries(entries, month)
            : entries;
    if (filterSection !== "all") list = list.filter((e) => e.section === filterSection);
    if (filterCategory !== "all") list = list.filter((e) => e.category === filterCategory);
    if (filterCustomer === "__none__") {
      list = list.filter((e) => !(e.account ?? "").trim());
    } else if (filterCustomer !== "all") {
      list = list.filter((e) => (e.account ?? "").trim() === filterCustomer);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.account ?? "").toLowerCase().includes(q) ||
          (e.supplier ?? "").toLowerCase().includes(q) ||
          e.date.includes(q) ||
          MONTH_NAMES[e.month - 1].toLowerCase().includes(q) ||
          String(e.year).includes(q)
      );
    }
    return list;
  }, [entries, date, month, monthScope, filterSection, filterCategory, filterCustomer, searchQuery]);

  // Category options follow the Type filter: Direct Cost shows only direct-cost
  // categories, Operating Expenses only operating ones, All types shows both.
  const categories = useMemo(() => {
    if (filterSection === "all") {
      return [
        ...mergeCategories("cos", custom.cos),
        ...mergeCategories("opex", custom.opex),
      ];
    }
    return mergeCategories(filterSection, custom[filterSection]);
  }, [filterSection, custom]);

  const onFilterSectionChange = (value: "all" | Section) => {
    setFilterSection(value);
    // Drop the category filter if it doesn't belong to the newly selected type
    if (
      filterCategory !== "all" &&
      value !== "all" &&
      !mergeCategories(value, custom[value]).includes(filterCategory)
    ) {
      setFilterCategory("all");
    }
  };

  // Live statement follows the list scope: day (default), month, or year
  const previewEntries = useMemo(() => {
    if (monthScope === "day") return entries.filter((e) => e.date === date);
    if (monthScope === "month") return selectMonthEntries(entries, month);
    return entries;
  }, [entries, monthScope, date, month]);
  const statement = useMemo(() => buildStatement(previewEntries), [previewEntries]);

  const previewTitle =
    monthScope === "day"
      ? dayLabel(date)
      : monthScope === "month"
        ? `${MONTH_NAMES[month - 1]} ${year}`
        : `${year}`;
  const previewPeriodLabel =
    monthScope === "day"
      ? `For the Day ${dayLabel(date)}`
      : monthScope === "month"
        ? `For the Month Ended ${monthEndLabel(year, month)}`
        : `For the Year Ended December 31, ${year}`;

  return (
    <div className="flex h-full gap-4 p-4">
      {/* LEFT — entry grid + entries list */}
      <div
        className={`flex min-w-[420px] flex-col gap-4 overflow-y-auto pr-1 transition-all ${
          showPreview ? "w-1/2" : "w-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Financial Entries</h1>
            <p className="text-xs text-muted-foreground">
              Encode daily transactions — the statement recalculates for the whole month.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
            title={showPreview ? "Hide live preview" : "Show live preview"}
          >
            {showPreview ? <PanelRightClose /> : <PanelRightOpen />}
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
        </div>

        <EntryGrid />

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Entries — {previewTitle}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({scoped.length} record{scoped.length === 1 ? "" : "s"})
                </span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                disabled={scoped.length === 0}
                onClick={() => setConfirmDeleteAll(true)}
              >
                <Trash2 />
                Delete All
              </Button>
            </div>
            {/* Filters */}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Select
                value={monthScope}
                onChange={(e) => setMonthScope(e.target.value as "day" | "month" | "year")}
                aria-label="Scope"
              >
                <option value="day">Selected day</option>
                <option value="month">Current month</option>
                <option value="year">Whole year</option>
              </Select>
              <Select
                value={filterSection}
                onChange={(e) => onFilterSectionChange(e.target.value as "all" | Section)}
                aria-label="Type"
              >
                <option value="all">All types</option>
                {ENTRY_SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SECTION_LABELS[s]}
                  </option>
                ))}
              </Select>
              <Select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                aria-label="Category"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
                aria-label="Customer"
              >
                <option value="all">All customers</option>
                {hasUnassignedCustomer && (
                  <option value="__none__">(No customer)</option>
                )}
                {customerOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <EntriesTable
              entries={scoped}
              onEdit={openEdit}
              onDelete={setConfirmDelete}
              decimals={company?.decimalPlaces ?? 2}
            />
          </CardContent>
        </Card>
      </div>

      {/* RIGHT — retractable live income statement */}
      {showPreview && (
        <div className="w-1/2 overflow-y-auto rounded-xl border bg-muted/40 p-4">
          <div className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Live Preview — {previewTitle}
          </div>
          <StatementReport
            company={company}
            periodLabel={previewPeriodLabel}
            statement={statement}
          />
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)}>
        <DialogTitle>Edit Entry</DialogTitle>
        <DialogDescription>
          {editing && SECTION_LABELS[editing.section]} — changes save to the month of the
          chosen date.
        </DialogDescription>
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <DatePicker value={editDate} onChange={setEditDate} />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Amount (VAT inclusive)
                  {editTotal !== null && isMathExpression(editAmount) && (
                    <span className="ml-2 font-normal text-primary">
                      = {formatMoney(editTotal, 2)}
                    </span>
                  )}
                </Label>
                <Input
                  inputMode="decimal"
                  value={editAmount}
                  placeholder="0.00 or 100+200"
                  title="Add receipts with math: 1500+2300+800"
                  onChange={(e) => {
                    if (/^[\d+\-.\s]*$/.test(e.target.value)) setEditAmount(e.target.value);
                  }}
                />
              </div>
            </div>
            {editTotal !== null && editTotal >= 0 && (
              <div className="flex justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs tabular-nums">
                <span className="text-muted-foreground">VAT (12%): {formatMoney(editVat, 2)}</span>
                <span className="font-semibold">Net of VAT: {formatMoney(editNet, 2)}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={editSection}
                  onChange={(e) => onEditSectionChange(e.target.value as Section)}
                >
                  {ENTRY_SECTIONS.map((s) => (
                    <option key={s} value={s}>
                      {SECTION_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                  {editCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {/* Preserve a legacy/custom value even if it's no longer listed */}
                  {editCategory && !editCategories.includes(editCategory) && (
                    <option value={editCategory}>{editCategory}</option>
                  )}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Customer of Revenue</Label>
                <Select value={editAccount} onChange={(e) => setEditAccount(e.target.value)}>
                  <option value="">— None —</option>
                  {/* Preserve a legacy account value even if it was later removed */}
                  {editAccount && !accounts.includes(editAccount) && (
                    <option value={editAccount}>{editAccount}</option>
                  )}
                  {accounts.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mode of Payment</Label>
                <Select
                  value={editPaymentMode}
                  onChange={(e) => setEditPaymentMode(e.target.value)}
                >
                  <option value="">— None —</option>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Input
                  value={editSupplier}
                  onChange={(e) => setEditSupplier(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={!editDate || editTotal === null}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete ALL confirmation */}
      <Dialog open={confirmDeleteAll} onClose={() => setConfirmDeleteAll(false)}>
        <DialogTitle>Delete all listed entries?</DialogTitle>
        <DialogDescription>
          This deletes the {scoped.length} entr{scoped.length === 1 ? "y" : "ies"} currently
          shown in the list ({previewTitle}
          {filterSection !== "all" || filterCategory !== "all" || filterCustomer !== "all"
            ? ", with your filters applied"
            : ""}
          ). You can undo this with Ctrl+Z.
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDeleteAll(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deletingAll}
            onClick={async () => {
              setDeletingAll(true);
              try {
                await removeMany(scoped);
              } finally {
                setDeletingAll(false);
                setConfirmDeleteAll(false);
              }
            }}
          >
            {deletingAll ? "Deleting…" : `Delete ${scoped.length} Entr${scoped.length === 1 ? "y" : "ies"}`}
          </Button>
        </div>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete entry?</DialogTitle>
        <DialogDescription>
          {confirmDelete && (
            <>
              {confirmDelete.category} — {confirmDelete.description || "no description"} (
              {confirmDelete.amount.toLocaleString()}). You can undo this with Ctrl+Z.
            </>
          )}
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (confirmDelete) await removeEntry(confirmDelete);
              setConfirmDelete(null);
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
