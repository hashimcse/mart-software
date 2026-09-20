# Windows executable launcher

Double-click `Supermarket POS.exe` in the project root. A progress window starts the local application, then opens the default browser. The launcher is compiled from `Program.cs` using the Windows .NET Framework compiler; `server-runner.cjs` redirects server output into `.local` logs.

The executable needs the complete project folder, Node.js 22.12+ with npm, and PostgreSQL 14+. It is not a standalone bundle or signed installer. First setup needs internet access. Local demo data and generated credentials persist in `.local`; exclude that directory from source distributions.

## Rebuild (PowerShell, from project root)

```powershell
& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /optimize+ /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/out:$PWD\Supermarket POS.exe" "$PWD\launcher\Program.cs"
```

## Diagnostic modes

- `--check`: checks runtime discovery and writes `.local/launcher-check.txt`.
- `--start-only`: starts the application without a progress window or browser; exits nonzero on failure.
- `.local/launcher.log`, `.local/api-error.log` and `.local/postgres.log` contain startup diagnostics.

When automating a test, use the returned process object's `WaitForExit`, rather than PowerShell `Start-Process -Wait`, which can also wait for the long-lived database/server descendants.
