using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class Program
{
    internal static readonly string Root = ResolveRoot();
    private static string ResolveRoot()
    {
        string root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        string pointer = Path.Combine(root, "relocated-to.txt");
        if (!File.Exists(pointer)) return root;
        string destination = File.ReadAllText(pointer).Trim();
        if (!Path.IsPathRooted(destination) || !File.Exists(Path.Combine(destination, "backend", "package.json")))
            throw new Exception("The relocated POS folder is unavailable: " + destination);
        return destination;
    }
    internal static readonly string Local = Path.Combine(Root, ".local");
    internal static readonly string LogFile = Path.Combine(Local, "launcher.log");
    internal static Action<string> Status = text => Log(text);
    private static readonly Dictionary<string, string> Env = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    private static string Node, PgBin;

    [STAThread]
    private static int Main(string[] args)
    {
        Directory.CreateDirectory(Local);
        string key;
        using (var sha = SHA256.Create()) key = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Root.ToLowerInvariant()))).Replace("-", "").Substring(0, 20);
        using (var mutex = new Mutex(false, "Local\\SupermarketPOS-" + key))
        {
            bool acquired;
            try { acquired = mutex.WaitOne(0); } catch (AbandonedMutexException) { acquired = true; }
            if (!acquired) { if (!args.Contains("--start-only")) MessageBox.Show("The POS is already starting. Please wait a moment.", "Supermarket POS"); return 0; }
            try
            {
                if (args.Contains("--check")) { FindTools(); File.WriteAllText(Path.Combine(Local, "launcher-check.txt"), "OK\r\nNode: " + Node + "\r\nPostgreSQL: " + PgBin); return 0; }
                if (args.Contains("--start-only")) { Start(); return 0; }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new LaunchWindow());
                return 0;
            }
            catch (Exception error) { Log(error.ToString()); return 1; }
            finally { mutex.ReleaseMutex(); }
        }
    }

    private static void FindTools()
    {
        Node = FindExecutable("node.exe", Path.Combine(Root, "runtime", "node.exe"), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe"));
        if (Node == null) throw new Exception("Node.js 22.12 or newer is required. Install Node.js, then double-click this launcher again.");
        var version = Run(Node, "--version", Root, false).Trim().TrimStart('v').Split('.');
        if (int.Parse(version[0]) < 22 || (int.Parse(version[0]) == 22 && int.Parse(version[1]) < 12)) throw new Exception("Update Node.js to version 22.12 or newer.");
        PgBin = Path.Combine(Root, "runtime", "postgres", "bin");
        if (!File.Exists(Path.Combine(PgBin, "pg_ctl.exe")))
        {
            var pgRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "PostgreSQL");
            PgBin = Directory.Exists(pgRoot) ? Directory.GetDirectories(pgRoot).OrderByDescending(p => { int v; return int.TryParse(Path.GetFileName(p), out v) ? v : 0; }).Select(p => Path.Combine(p, "bin")).FirstOrDefault(p => File.Exists(Path.Combine(p, "pg_ctl.exe"))) : null;
        }
        if (PgBin == null) throw new Exception("PostgreSQL 14 or newer is required. Install PostgreSQL, then double-click this launcher again.");
        if (!File.Exists(Path.Combine(Root, "backend", "package.json"))) throw new Exception("Keep Supermarket POS.exe in the supermarket-pos folder beside backend and frontend. Extract the whole ZIP before opening it.");
    }

    private static string FindExecutable(string name, params string[] candidates)
    {
        return candidates.Concat((Environment.GetEnvironmentVariable("PATH") ?? "").Split(';').Where(p => p.Length > 0).Select(p => Path.Combine(p.Trim('"'), name))).FirstOrDefault(File.Exists);
    }

    private static string RandomSecret(int count)
    {
        var bytes = new byte[count]; using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
        return BitConverter.ToString(bytes).Replace("-", "");
    }

    internal static void Start()
    {
        Status("Checking your POS installation…");
        FindTools();
        string config = Path.Combine(Local, "demo.env");
        if (!File.Exists(config))
        {
            File.WriteAllLines(config, new[] {
                "NODE_ENV=production", "HOST=127.0.0.1", "PORT=4010", "CORS_ORIGIN=http://localhost:4010",
                "DATABASE_URL=postgresql://pos_demo:" + RandomSecret(24) + "@127.0.0.1:55440/pos_demo",
                "ACCESS_TOKEN_SECRET=" + RandomSecret(48), "PG_BIN_DIR=" + PgBin, "BACKUP_DIR=" + Path.Combine(Local,"backups"),
                "BACKUP_INTERVAL_HOURS=24", "SEED_DEMO=true"
            }, new UTF8Encoding(false));
        }
        foreach (string line in File.ReadAllLines(config))
        {
            if (line.TrimStart().StartsWith("#")) continue;
            int split = line.IndexOf('='); if (split > 0) Env[line.Substring(0, split).Trim()] = line.Substring(split + 1).Trim();
        }
        Env["PG_BIN_DIR"] = PgBin;
        Env["HOST"] = "127.0.0.1";
        Env["PATH"] = Path.GetDirectoryName(Node) + ";" + PgBin + ";" + Environment.GetEnvironmentVariable("PATH");
        if (IsReady()) { Status("Your POS is ready."); return; }

        var db = new Uri(Env["DATABASE_URL"]);
        if (db.Port != 55440 || db.AbsolutePath != "/pos_demo" || db.Host != "127.0.0.1") throw new Exception("This launcher manages only its local demo database. Use the deployment guide for a custom store database.");
        string[] credentials = db.UserInfo.Split(new[] { ':' }, 2);
        Env["PGPASSWORD"] = Uri.UnescapeDataString(credentials[1]);
        Env["PGCONNECT_TIMEOUT"] = "10";
        string data = Path.Combine(Local, "pgdata");
        if (!File.Exists(Path.Combine(data, "PG_VERSION")))
        {
            Status("Preparing your local database for the first time…");
            string password = Path.Combine(Local, "init-password.txt");
            File.WriteAllText(password, Env["PGPASSWORD"] + "\n", new UTF8Encoding(false));
            try { Run(Pg("initdb"), "-D " + Quote(data) + " -U pos_demo --auth=scram-sha-256 --encoding=UTF8 --locale=C --pwfile=" + Quote(password), Root); }
            finally { File.Delete(password); }
            File.AppendAllText(Path.Combine(data, "postgresql.conf"), "\nlisten_addresses = '127.0.0.1'\nport = 55440\n");
        }
        Status("Starting the database…");
        if (RunCode(Pg("pg_ctl"), "-D " + Quote(data) + " status", Root) != 0)
            RunDetached(Pg("pg_ctl"), "-D " + Quote(data) + " -l " + Quote(Path.Combine(Local,"postgres.log")) + " -w start", Root);
        string exists = Run(Pg("psql"), "-h 127.0.0.1 -p 55440 -U pos_demo -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='pos_demo'\"", Root).Trim();
        if (exists != "1") Run(Pg("createdb"), "-h 127.0.0.1 -p 55440 -U pos_demo pos_demo", Root);

        string backend = Path.Combine(Root,"backend"), frontend = Path.Combine(Root,"frontend");
        string marker = Path.Combine(Local,"launcher-build.sha256"), fingerprint = Fingerprint();
        bool built = File.Exists(Path.Combine(backend,"dist","server.js")) && File.Exists(Path.Combine(frontend,"dist","index.html")) && File.Exists(Path.Combine(backend,"node_modules","express","package.json"));
        // Existing verified builds from START-DEMO.ps1 can be adopted without downloads.
        bool changed = File.Exists(marker) && File.ReadAllText(marker) != fingerprint;
        if (!built || changed)
        {
            Status("First-time setup: installing the POS. This may take a few minutes…");
            Npm("ci --include=dev", backend); Npm("run prisma:generate",backend); Npm("run prisma:deploy",backend);
            Npm("run build",backend);
            Npm("ci --include=dev",frontend); Env["VITE_API_BASE_URL"]="/api"; Npm("run build",frontend);
        }
        if (!File.Exists(Path.Combine(Local,"seeded")))
        {
            Status("Preparing demo products and accounts…");
            Npm("run prisma:deploy",backend); Npm("run prisma:seed",backend); File.WriteAllText(Path.Combine(Local,"seeded"),"Demo initialized");
        }
        File.WriteAllText(marker,fingerprint);
        Status("Starting the POS…");
        var info = Info(Node, Quote(Path.Combine(Root,"launcher","server-runner.cjs")), backend);
        info.RedirectStandardOutput=false; info.RedirectStandardError=false;
        var server = Process.Start(info);
        File.WriteAllText(Path.Combine(Local,"api.pid"),server.Id.ToString());
        for (int i=0;i<120;i++) { if(IsReady()) { Status("Your POS is ready.");return; } if(server.HasExited)throw new Exception("The POS server could not start. See .local/api-error.log.");Thread.Sleep(500); }
        throw new Exception("The POS is taking longer than expected. See .local/api-error.log, then open the launcher again.");
    }

    internal static string Url { get { return "http://localhost:" + (Env.ContainsKey("PORT") ? Env["PORT"] : "4010"); } }
    private static bool IsReady()
    {
        try
        {
            using(var client = new TimedWebClient())
                return client.DownloadString(Url.Replace("localhost", "127.0.0.1")+"/api/health").Contains("\"status\":\"ok\"") && client.DownloadString(Url.Replace("localhost", "127.0.0.1")).Contains("<title>Supermarket POS</title>");
        }
        catch { return false; }
    }
    private static string Fingerprint()
    {
        var files = new List<string>();
        foreach(string dir in new[]{"backend/src","backend/prisma","frontend/src"})
            files.AddRange(Directory.GetFiles(Path.Combine(Root,dir.Replace('/',Path.DirectorySeparatorChar)),"*",SearchOption.AllDirectories).Where(f=>!f.Contains(Path.DirectorySeparatorChar+"generated"+Path.DirectorySeparatorChar)));
        files.Add(Path.Combine(Root,"backend","package-lock.json"));files.Add(Path.Combine(Root,"frontend","package-lock.json"));
        using(var hash=SHA256.Create()) using(var memory=new MemoryStream())
        { foreach(string file in files.OrderBy(f=>f)){byte[] name=Encoding.UTF8.GetBytes(file.Substring(Root.Length));memory.Write(name,0,name.Length);byte[] content=File.ReadAllBytes(file);memory.Write(content,0,content.Length);}return BitConverter.ToString(hash.ComputeHash(memory.ToArray())).Replace("-",""); }
    }
    private static string Pg(string command) { return Path.Combine(PgBin,command+".exe"); }
    private static string Quote(string value) { return "\""+value.Replace("\"","")+"\""; }
    private static void Npm(string arguments,string directory)
    {
        var npm=Path.Combine(Path.GetDirectoryName(Node),"node_modules","npm","bin","npm-cli.js");
        if(!File.Exists(npm))throw new Exception("The Node.js installation is missing npm. Reinstall Node.js with npm included.");
        Run(Node,Quote(npm)+" "+arguments,directory);
    }
    private static ProcessStartInfo Info(string file,string arguments,string directory)
    {
        var info=new ProcessStartInfo(file,arguments){WorkingDirectory=directory,UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardOutput=true,RedirectStandardError=true};
        foreach(var value in Env)info.EnvironmentVariables[value.Key]=value.Value;
        return info;
    }
    private static int RunCode(string file,string arguments,string directory)
    { using(var process=Process.Start(Info(file,arguments,directory))) {var output=process.StandardOutput.ReadToEndAsync();var error=process.StandardError.ReadToEndAsync();if(!process.WaitForExit(60000)){process.Kill();throw new Exception("Database status check timed out.");}Task.WaitAll(output,error);return process.ExitCode;} }
    private static void RunDetached(string file,string arguments,string directory)
    {
        // PostgreSQL is a long-lived descendant. Do not give it inherited pipes
        // whose EOF would wait for the database server to shut down.
        var info=Info(file,arguments,directory);info.RedirectStandardOutput=false;info.RedirectStandardError=false;
        using(var process=Process.Start(info)){if(!process.WaitForExit(90000))throw new Exception("Database startup timed out. See .local/postgres.log.");if(process.ExitCode!=0)throw new Exception("Database could not start. See .local/postgres.log.");}
    }
    private static string Run(string file,string arguments,string directory,bool log=true)
    {
        using(var process=Process.Start(Info(file,arguments,directory)))
        {
            var output=process.StandardOutput.ReadToEndAsync();var error=process.StandardError.ReadToEndAsync();
            if(!process.WaitForExit(15*60*1000)){process.Kill();throw new Exception(Path.GetFileName(file)+" timed out. Check your connection and open the launcher again.");}
            Task.WaitAll(output,error);if(log)Log(Path.GetFileName(file)+": "+output.Result+error.Result);
            if(process.ExitCode!=0)throw new Exception(Path.GetFileName(file)+" failed. "+error.Result+"\r\nDetails: "+LogFile);
            return output.Result;
        }
    }
    internal static void Log(string text) { File.AppendAllText(LogFile,DateTime.Now.ToString("s")+" "+text+Environment.NewLine); }
    private class TimedWebClient:WebClient { protected override WebRequest GetWebRequest(Uri address){var request=base.GetWebRequest(address);request.Proxy=null;request.Timeout=2000;return request;} }
}

internal sealed class LaunchWindow:Form
{
    private readonly Label status;
    internal LaunchWindow()
    {
        Text="Supermarket POS";ClientSize=new Size(520,210);StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;BackColor=Color.FromArgb(247,247,243);
        Controls.Add(new Label{Text="Supermarket POS",Font=new Font("Segoe UI",21,FontStyle.Bold),ForeColor=Color.FromArgb(24,74,61),Location=new Point(30,25),AutoSize=true});
        status=new Label{Text="Starting your store…",Font=new Font("Segoe UI",10),Location=new Point(32,90),Size=new Size(455,48)};Controls.Add(status);
        Controls.Add(new ProgressBar{Location=new Point(32,155),Size=new Size(455,8),Style=ProgressBarStyle.Marquee});
        Program.Status=text=>{Program.Log(text);if(!IsDisposed)BeginInvoke((Action)(()=>status.Text=text));};
        Shown+=async(sender,args)=>{try{await Task.Run((Action)Program.Start);Process.Start(new ProcessStartInfo(Program.Url){UseShellExecute=true});Close();}catch(Exception error){Program.Log(error.ToString());MessageBox.Show(this,error.Message,"POS could not start",MessageBoxButtons.OK,MessageBoxIcon.Error);Close();}};
    }
}
