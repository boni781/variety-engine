import os, shutil, subprocess, sys, threading, tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

APP_NAME = "Variety Engine"
EXE_NAME = "VarietyEngine.exe"

def base_dir():
    return Path(sys._MEIPASS) if getattr(sys, "frozen", False) else Path(__file__).resolve().parent.parent

def source_dir():
    return base_dir() / "dist" / "VarietyEngine"

def default_dir():
    return Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Programs" / "Variety Engine"

def shortcut(target, link):
    ps = shutil.which("powershell.exe")
    if not ps: return False
    q = lambda s: s.replace("'", "''")
    script = (
        "$w=New-Object -ComObject WScript.Shell;"
        f"$s=$w.CreateShortcut('{q(str(link))}');"
        f"$s.TargetPath='{q(str(target))}';"
        f"$s.WorkingDirectory='{q(str(target.parent))}';"
        f"$s.IconLocation='{q(str(target))},0';"
        f"$s.Description='{APP_NAME}';$s.Save()"
    )
    r = subprocess.run([ps, "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
                       capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
    return r.returncode == 0 and link.exists()

class Installer:
    def __init__(self, root):
        self.root=root
        root.title("Variety Engine Setup")
        root.geometry("680x460")
        root.resizable(False,False)
        root.configure(bg="#f5f7fb")
        self.build()

    def build(self):
        h=tk.Frame(self.root,bg="#172033",height=105); h.pack(fill="x"); h.pack_propagate(False)
        tk.Label(h,text="V",font=("Segoe UI",28,"bold"),fg="white",bg="#2563eb",
                 width=3).place(x=34,y=25)
        tk.Label(h,text="Variety Engine",font=("Segoe UI",22,"bold"),
                 fg="white",bg="#172033").place(x=125,y=22)
        tk.Label(h,text="Setup & Installation",font=("Segoe UI",10),
                 fg="#cbd5e1",bg="#172033").place(x=127,y=60)

        m=tk.Frame(self.root,bg="#f5f7fb"); m.pack(fill="both",expand=True,padx=34,pady=22)
        tk.Label(m,text="Install Variety Engine",font=("Segoe UI",16,"bold"),
                 fg="#172033",bg="#f5f7fb").pack(anchor="w")
        tk.Label(m,text="Pilih lokasi instalasi aplikasi.",font=("Segoe UI",9),
                 fg="#64748b",bg="#f5f7fb").pack(anchor="w",pady=(5,20))

        tk.Label(m,text="Lokasi instalasi",font=("Segoe UI",10,"bold"),
                 fg="#334155",bg="#f5f7fb").pack(anchor="w")
        row=tk.Frame(m,bg="#f5f7fb"); row.pack(fill="x",pady=(7,20))
        self.loc=tk.StringVar(value=str(default_dir()))
        self.entry=tk.Entry(row,textvariable=self.loc,font=("Segoe UI",10),relief="solid",bd=1)
        self.entry.pack(side="left",fill="x",expand=True,ipady=8)
        self.browse=tk.Button(row,text="Browse",command=self.browse_folder,bg="#e2e8f0",
                              fg="#334155",relief="flat",padx=14,pady=8)
        self.browse.pack(side="left",padx=(8,0))

        self.sc=tk.BooleanVar(value=True)
        tk.Checkbutton(m,text="Buat shortcut Variety Engine di Desktop",variable=self.sc,
                       font=("Segoe UI",9),fg="#334155",bg="#f5f7fb",
                       activebackground="#f5f7fb",selectcolor="#f5f7fb").pack(anchor="w")

        self.status=tk.StringVar(value="Siap untuk instalasi.")
        tk.Label(m,textvariable=self.status,font=("Segoe UI",9),
                 fg="#64748b",bg="#f5f7fb").pack(anchor="w",pady=(22,7))
        self.progress=ttk.Progressbar(m,maximum=100); self.progress.pack(fill="x")

        b=tk.Frame(m,bg="#f5f7fb"); b.pack(fill="x",pady=(24,0))
        tk.Button(b,text="Batal",command=self.root.destroy,bg="#e2e8f0",
                  fg="#334155",relief="flat",padx=18,pady=9).pack(side="right")
        self.install=tk.Button(b,text="Install",command=self.start,bg="#2563eb",
                               fg="white",relief="flat",padx=25,pady=9)
        self.install.pack(side="right",padx=(0,8))

    def browse_folder(self):
        p=filedialog.askdirectory(title="Pilih Lokasi Instalasi")
        if p: self.loc.set(p)

    def start(self):
        src=source_dir()
        if not src.exists():
            messagebox.showerror("File Tidak Ditemukan",
                                 f"Folder hasil build tidak ditemukan:\n\n{src}")
            return
        self.install.config(state="disabled"); self.browse.config(state="disabled")
        self.entry.config(state="disabled")
        threading.Thread(target=self.do_install,args=(Path(self.loc.get()),src),daemon=True).start()

    def set(self,s,p):
        self.root.after(0,lambda:(self.status.set(s),self.progress.configure(value=p)))

    def do_install(self,root,src):
        try:
            app=root/"VarietyEngine"; exe=app/EXE_NAME
            self.set("Menyiapkan folder instalasi...",10)
            if app.exists():
                try: shutil.rmtree(app)
                except PermissionError: raise PermissionError("Versi Variety Engine lama masih berjalan. Tutup aplikasi tersebut.")
            self.set("Menyalin file aplikasi...",35)
            shutil.copytree(src,app)
            self.set("Memeriksa file aplikasi...",70)
            if not exe.exists(): raise FileNotFoundError(f"{EXE_NAME} tidak ditemukan.")
            msg="Shortcut Desktop tidak dibuat."
            if self.sc.get():
                self.set("Membuat shortcut Desktop...",85)
                desk=Path.home()/"Desktop"; desk.mkdir(exist_ok=True)
                msg="Shortcut Desktop berhasil dibuat." if shortcut(exe,desk/"Variety Engine.lnk") else "Shortcut Desktop gagal dibuat."
            self.set("Instalasi selesai.",100)
            self.root.after(100,lambda:self.finish(exe,app,msg))
        except Exception as e:
            self.root.after(100,lambda:messagebox.showerror("Instalasi Gagal",str(e)))

    def finish(self,exe,app,msg):
        messagebox.showinfo("Instalasi Berhasil",
                            f"Variety Engine berhasil diinstal.\n\nLokasi:\n{app}\n\n{msg}")
        try: subprocess.Popen([str(exe)],cwd=str(app))
        except Exception as e: messagebox.showwarning("Peringatan",f"Instalasi berhasil, tetapi aplikasi tidak dapat dibuka otomatis.\n\n{e}")
        self.root.destroy()

if __name__=="__main__":
    root=tk.Tk()
    Installer(root)
    root.mainloop()
