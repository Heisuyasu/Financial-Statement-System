import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Save,
  ImagePlus,
  Trash2,
  Plus,
  Wallet,
  Tags,
  DatabaseBackup,
  Download,
  RotateCcw,
} from "lucide-react";
import { useCompanyStore } from "@/store/useCompanyStore";
import { useAppStore } from "@/store/useAppStore";
import { useAccountsStore } from "@/store/useAccountsStore";
import { useCategoriesStore } from "@/store/useCategoriesStore";
import { api, isElectron } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MONTH_NAMES, SECTION_LABELS, ENTRY_SECTIONS } from "@/lib/categories";
import type { Section } from "@/types";

interface SettingsForm {
  name: string;
  address: string;
  tin: string;
  currency: string;
  fiscalYearStart: number;
  decimalPlaces: number;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
}

export function SettingsPage() {
  const { company, save, load } = useCompanyStore();
  const { theme, toggleTheme, notify } = useAppStore();
  const { accounts, load: loadAccounts, add: addAccount, remove: removeAccount } =
    useAccountsStore();
  const {
    custom: customCategories,
    load: loadCategories,
    add: addCategory,
    remove: removeCategory,
  } = useCategoriesStore();
  const [logo, setLogo] = useState<string>(company?.logo ?? "");
  const [newAccount, setNewAccount] = useState("");
  const [newCatSection, setNewCatSection] = useState<Section>("cos");
  const [newCatName, setNewCatName] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  // "pick" = choose a file in a dialog; otherwise a specific auto-backup
  const [restoreTarget, setRestoreTarget] = useState<
    null | "pick" | { name: string; path: string }
  >(null);
  const [restoring, setRestoring] = useState(false);
  const [autoBackups, setAutoBackups] = useState<
    { name: string; path: string; size: number; modified: string }[]
  >([]);

  useEffect(() => {
    if (isElectron) api.db.autoBackups().then(setAutoBackups).catch(() => setAutoBackups([]));
  }, []);

  const runBackup = async () => {
    setBackingUp(true);
    try {
      const result = await api.db.backup();
      notify(result.saved ? `Backup saved to ${result.path ?? "file"}` : "Backup cancelled");
    } finally {
      setBackingUp(false);
    }
  };

  const runRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const result =
        restoreTarget === "pick"
          ? await api.db.restore()
          : await api.db.restoreFrom(restoreTarget.path);
      if (result.restored) {
        notify("Backup restored — the app will restart now");
      } else if (result.error) {
        notify(result.error);
        setRestoreTarget(null);
      } else {
        setRestoreTarget(null); // cancelled in the file dialog
      }
    } finally {
      setRestoring(false);
    }
  };

  const backupDateLabel = (name: string) => {
    const m = /AutoBackup_(\d{4})-(\d{2})-(\d{2})/.exec(name);
    if (!m) return name;
    return `${MONTH_NAMES[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
  };

  const sizeLabel = (bytes: number) =>
    bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  useEffect(() => {
    loadAccounts();
    loadCategories();
  }, [loadAccounts, loadCategories]);

  const submitAccount = async () => {
    const name = newAccount.trim();
    if (!name) return;
    await addAccount(name);
    setNewAccount("");
    notify(`Customer "${name}" added`);
  };

  const submitCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    await addCategory(newCatSection, name);
    setNewCatName("");
    notify(`Category "${name}" added to ${SECTION_LABELS[newCatSection]}`);
  };

  const { register, handleSubmit, reset } = useForm<SettingsForm>({
    defaultValues: {
      name: company?.name ?? "",
      address: company?.address ?? "",
      tin: company?.tin ?? "",
      currency: company?.currency ?? "PHP",
      fiscalYearStart: company?.fiscalYearStart ?? 1,
      decimalPlaces: company?.decimalPlaces ?? 2,
      preparedBy: company?.preparedBy ?? "",
      checkedBy: company?.checkedBy ?? "",
      approvedBy: company?.approvedBy ?? "",
    },
  });

  useEffect(() => {
    if (company) {
      reset({
        name: company.name,
        address: company.address,
        tin: company.tin,
        currency: company.currency,
        fiscalYearStart: company.fiscalYearStart,
        decimalPlaces: company.decimalPlaces,
        preparedBy: company.preparedBy ?? "",
        checkedBy: company.checkedBy ?? "",
        approvedBy: company.approvedBy ?? "",
      });
      setLogo(company.logo);
    }
  }, [company, reset]);

  const pickLogo = async () => {
    const dataUrl = await api.logo.pick();
    if (dataUrl) setLogo(dataUrl);
  };

  const onSubmit = handleSubmit(async (values) => {
    await save({
      ...values,
      fiscalYearStart: Number(values.fiscalYearStart),
      decimalPlaces: Number(values.decimalPlaces),
      logo,
    });
    await load();
    notify("Settings saved");
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Company profile and report preferences. These appear on every printed statement.
        </p>
      </div>

      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Company Profile</CardTitle>
            <CardDescription>Shown in report headers and exports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            <div className="flex items-center gap-4">
              {logo ? (
                <img
                  src={logo}
                  alt="Company logo"
                  className="h-16 w-16 rounded-lg border object-contain"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                  No logo
                </div>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={pickLogo} disabled={!isElectron}>
                  <ImagePlus />
                  {isElectron ? "Choose Logo…" : "Logo (desktop app only)"}
                </Button>
                {logo && (
                  <Button type="button" variant="ghost" onClick={() => setLogo("")}>
                    <Trash2 />
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-name">Company Name</Label>
                <Input id="s-name" {...register("name", { required: true })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-address">Address</Label>
                <Input id="s-address" {...register("address")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-tin">TIN</Label>
                <Input id="s-tin" placeholder="000-000-000-000" {...register("tin")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-currency">Currency</Label>
                <Select id="s-currency" {...register("currency")}>
                  <option value="PHP">PHP — Philippine Peso (₱)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                  <option value="JPY">JPY — Japanese Yen (¥)</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-fy">Fiscal Year Starts</Label>
                <Select id="s-fy" {...register("fiscalYearStart")}>
                  {MONTH_NAMES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-dp">Decimal Places</Label>
                <Select id="s-dp" {...register("decimalPlaces")}>
                  <option value={0}>0 — whole numbers</option>
                  <option value={2}>2 — centavos (standard)</option>
                </Select>
              </div>
            </div>

            {/* Report signatories */}
            <div className="border-t pt-4">
              <div className="mb-2 text-sm font-medium">Report Signatories</div>
              <p className="mb-3 text-xs text-muted-foreground">
                These names appear in the Prepared By / Checked By / Approved By blocks on
                every printed statement and PDF export.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="s-prepared">Prepared By</Label>
                  <Input id="s-prepared" placeholder="Name" {...register("preparedBy")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-checked">Checked By</Label>
                  <Input id="s-checked" placeholder="Name" {...register("checkedBy")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-approved">Approved By</Label>
                  <Input id="s-approved" placeholder="Name" {...register("approvedBy")} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm">
                <div className="font-medium">Theme</div>
                <div className="text-muted-foreground">
                  Currently {theme === "dark" ? "Dark" : "Light"} mode
                </div>
              </div>
              <Button type="button" variant="outline" onClick={toggleTheme}>
                Switch to {theme === "dark" ? "Light" : "Dark"}
              </Button>
            </div>

            <Button type="submit" className="w-full">
              <Save />
              Save Settings
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Customers of Revenue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            Customers of Revenue
          </CardTitle>
          <CardDescription>
            Manage the customers you can tag each transaction with when encoding entries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="s-new-account">New customer name</Label>
              <Input
                id="s-new-account"
                value={newAccount}
                placeholder="e.g. FLC, SOI/2GO, YM"
                onChange={(e) => setNewAccount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitAccount();
                  }
                }}
              />
            </div>
            <Button type="button" onClick={submitAccount} disabled={!newAccount.trim()}>
              <Plus />
              Add
            </Button>
          </div>

          {accounts.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No customers yet. Add one above — it will appear in the entry form's Customer of
              Revenue dropdown.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {accounts.map((acct) => (
                <li key={acct} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{acct}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={async () => {
                      await removeAccount(acct);
                      notify(`Customer "${acct}" removed`);
                    }}
                    title="Remove customer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="h-4 w-4" />
            Categories
          </CardTitle>
          <CardDescription>
            Add your own expense categories under Direct Cost or Operating Expenses. They
            appear in the entry form and on the statement alongside the built-in ones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="w-48 space-y-1.5">
              <Label htmlFor="s-cat-section">Type</Label>
              <Select
                id="s-cat-section"
                value={newCatSection}
                onChange={(e) => setNewCatSection(e.target.value as Section)}
              >
                {ENTRY_SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SECTION_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="s-cat-name">New category name</Label>
              <Input
                id="s-cat-name"
                value={newCatName}
                placeholder="e.g. Toll Fees, Warehouse Rental"
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitCategory();
                  }
                }}
              />
            </div>
            <Button type="button" onClick={submitCategory} disabled={!newCatName.trim()}>
              <Plus />
              Add
            </Button>
          </div>

          {ENTRY_SECTIONS.map((s) => (
            <div key={s} className="space-y-1.5">
              <div className="text-sm font-medium">{SECTION_LABELS[s]}</div>
              {customCategories[s].length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
                  No custom categories here yet — only the built-in ones are used.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {customCategories[s].map((cat) => (
                    <li
                      key={cat}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span>{cat}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={async () => {
                          await removeCategory(s, cat);
                          notify(`Category "${cat}" removed`);
                        }}
                        title="Remove category"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Backup & Restore */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseBackup className="h-4 w-4" />
            Backup &amp; Restore
          </CardTitle>
          <CardDescription>
            The app saves an automatic backup once a day (the newest 14 are kept). You can
            also back up manually to a USB drive or cloud folder so a computer problem
            can't lose your records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={runBackup} disabled={!isElectron || backingUp}>
              <Download />
              {backingUp ? "Backing up…" : "Backup Database…"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setRestoreTarget("pick")}
              disabled={!isElectron || restoring}
            >
              <RotateCcw />
              Restore from File…
            </Button>
            {!isElectron && (
              <span className="text-xs text-muted-foreground">
                Available in the desktop app only.
              </span>
            )}
          </div>

          {/* Automatic backups */}
          {isElectron && (
            <div>
              <div className="mb-1 text-sm font-medium">Automatic backups</div>
              {autoBackups.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  No automatic backups yet — the first one is created shortly after the app
                  starts.
                </p>
              ) : (
                <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
                  {autoBackups.map((b) => (
                    <li
                      key={b.name}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{backupDateLabel(b.name)}</div>
                        <div className="text-xs text-muted-foreground">
                          {sizeLabel(b.size)}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRestoreTarget({ name: b.name, path: b.path })}
                        disabled={restoring}
                      >
                        <RotateCcw />
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore confirmation */}
      <Dialog open={restoreTarget !== null} onClose={() => setRestoreTarget(null)}>
        <DialogTitle>Restore from a backup?</DialogTitle>
        <DialogDescription>
          {restoreTarget !== null && restoreTarget !== "pick" ? (
            <>
              This restores the automatic backup from{" "}
              <strong>{backupDateLabel(restoreTarget.name)}</strong> and replaces ALL
              current data — entries, customers and settings — then restarts the app.
            </>
          ) : (
            <>
              This replaces ALL current data — entries, customers and settings — with the
              contents of the backup file you choose, then restarts the app.
            </>
          )}{" "}
          A safety copy of your current data is kept automatically, but anything entered
          since the backup was made will not appear. Continue?
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRestoreTarget(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={runRestore} disabled={restoring}>
            {restoring
              ? "Restoring…"
              : restoreTarget === "pick"
                ? "Choose Backup File…"
                : "Restore This Backup"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
