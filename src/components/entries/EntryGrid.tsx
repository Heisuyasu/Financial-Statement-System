import { useEffect, useMemo, useState } from "react";
import { Save, CalendarDays, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAppStore } from "@/store/useAppStore";
import { useEntriesStore } from "@/store/useEntriesStore";
import { useAccountsStore } from "@/store/useAccountsStore";
import { useCategoriesStore } from "@/store/useCategoriesStore";
import {
  SECTION_LABELS,
  ENTRY_SECTIONS,
  PAYMENT_MODES,
  MONTH_NAMES,
  mergeCategories,
} from "@/lib/categories";
import {
  evalAmountExpression,
  isMathExpression,
  formatMoney,
  vatOf,
  netOf,
} from "@/lib/format";
import type { Section } from "@/types";

export function EntryGrid() {
  const { date, setDate, setPage, notify } = useAppStore();
  const { addEntry } = useEntriesStore();
  const { accounts, load: loadAccounts } = useAccountsStore();
  const { custom, load: loadCategories } = useCategoriesStore();

  const [section, setSection] = useState<Section>("cos");
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [account, setAccount] = useState("");
  const [paymentMode, setPaymentMode] = useState<string>(PAYMENT_MODES[0]);
  const [supplier, setSupplier] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAccounts();
    loadCategories();
  }, [loadAccounts, loadCategories]);

  const categories = useMemo(
    () => mergeCategories(section, custom[section]),
    [section, custom]
  );

  // Keep the category valid whenever the section (or category list) changes.
  useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // year/month derived from the picked date
  const { year, month } = useMemo(() => {
    const [y, m] = date.split("-").map(Number);
    return { year: y || new Date().getFullYear(), month: m || 1 };
  }, [date]);

  // The amount typed is the VAT-inclusive total; net and VAT are extracted from it.
  const total = evalAmountExpression(amount) ?? 0;
  const hasAmount = total > 0;
  const vat = hasAmount ? vatOf(total) : 0;
  const net = hasAmount ? netOf(total) : 0;
  const showsMath = hasAmount && isMathExpression(amount);

  const resetForm = () => {
    setAmount("");
    setDescription("");
    setSupplier("");
    // section, category, account, paymentMode intentionally kept for fast repeat entry
  };

  const save = async () => {
    if (!hasAmount) {
      notify("Enter an amount greater than 0");
      return;
    }
    if (!date) {
      notify("Pick a date first");
      return;
    }
    const expr = amount.replace(/\s+/g, "");
    setSaving(true);
    try {
      await addEntry({
        section,
        date,
        year,
        month,
        category,
        description: description.trim(),
        amount: net,
        vat,
        account,
        paymentMode,
        supplier: supplier.trim(),
        breakdown: isMathExpression(expr) ? expr : "",
      });
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          New Entry
        </CardTitle>
        <CardDescription>
          Record one transaction at a time. VAT (12%) is computed automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          id="entry-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="space-y-4"
        >
          {/* Date */}
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-date">Date</Label>
              <DatePicker id="g-date" className="w-52" value={date} onChange={setDate} />
            </div>
            <div className="pb-2 text-sm text-muted-foreground">
              Posting to{" "}
              <span className="font-semibold text-foreground">
                {MONTH_NAMES[month - 1]} {year}
              </span>
            </div>
          </div>

          {/* Type + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-section">Type</Label>
              <Select
                id="g-section"
                value={section}
                onChange={(e) => setSection(e.target.value as Section)}
              >
                {ENTRY_SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SECTION_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-category">Category</Label>
              <Select
                id="g-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Amount + Account */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-amount">Amount (VAT inclusive)</Label>
              <Input
                id="g-amount"
                inputMode="decimal"
                value={amount}
                placeholder="0.00 or 100+200"
                title="Add receipts with math: 1500+2300+800"
                onChange={(e) => {
                  if (/^[\d+\-.\s]*$/.test(e.target.value)) setAmount(e.target.value);
                }}
              />
              {/* Live per-entry VAT breakdown (extracted from the total) */}
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                {hasAmount ? (
                  <div className="space-y-0.5 tabular-nums">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total incl. VAT</span>
                      <span>{formatMoney(total, 2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>VAT (12%)</span>
                      <span>{formatMoney(vat, 2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-foreground">
                      <span>Net of VAT</span>
                      <span>{formatMoney(net, 2)}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    Enter the total amount to see the 12% VAT breakdown.
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-account">Customer of Revenue</Label>
              <Select
                id="g-account"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">— None —</option>
                {accounts.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
              {accounts.length === 0 && (
                <button
                  type="button"
                  onClick={() => setPage("settings")}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <SettingsIcon className="h-3 w-3" />
                  Add customers in Settings
                </button>
              )}
            </div>
          </div>

          {/* Description (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="g-desc">Description (optional)</Label>
            <Input
              id="g-desc"
              value={description}
              placeholder="Notes for this transaction"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Mode of payment + Supplier */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-payment">Mode of Payment</Label>
              <Select
                id="g-payment"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-supplier">Supplier</Label>
              <Input
                id="g-supplier"
                value={supplier}
                placeholder="Supplier / payee name"
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" disabled={saving || !hasAmount} className="w-full">
            <Save />
            {hasAmount
              ? `Save Entry — ${formatMoney(total, 2)} total, ${formatMoney(net, 2)} net (Ctrl+S)`
              : "Enter an amount to save (Ctrl+S)"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
