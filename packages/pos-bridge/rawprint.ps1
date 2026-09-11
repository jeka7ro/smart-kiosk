param (
    [Parameter(Mandatory=$true)][string]$PrinterName,
    [Parameter(Mandatory=$true)][string]$FilePath
)

# 1. Auto-resolve exact installed printer name & fallback if in Error
try {
    $printers = @(Get-Printer)
    $target = $printers | Where-Object { $_.Name -eq $PrinterName }
    
    # Daca imprimanta curenta e in stare de Error, comutam automat pe imprimanta sanatoasa Epson (ex: Receipt6)
    if ($target -and ($target.PrinterStatus -eq "Error" -or $target.PrinterStatus -eq 1 -or $target.PrinterStatus -eq 2)) {
        $healthy = $printers | Where-Object { 
            ($_.Name -like "*EPSON*" -or $_.Name -like "*Receipt*") -and 
            $_.Name -ne $PrinterName -and 
            $_.PrinterStatus -ne "Error"
        } | Select-Object -First 1
        if ($healthy) {
            Write-Output "[WinSpool] Comut de la '$PrinterName' (Eroare) la '$($healthy.Name)'"
            $PrinterName = $healthy.Name
        }
    }
    
    if (-not ($printers.Name -contains $PrinterName)) {
        $matched = $printers | Where-Object { 
            ($_.Name -like "*$PrinterName*" -or 
            $PrinterName -like "*$($_.Name)*" -or 
            ($_.Name -like "*Receipt6*") -or
            ($_ -like "*EPSON*" -and $_ -like "*Receipt*") -or
            ($_ -like "*EPSON*" -and $_ -like "*TM*")) -and
            $_.PrinterStatus -ne "Error"
        } | Select-Object -First 1
        if ($matched) {
            $PrinterName = $matched.Name
        }
    }
} catch {}

# 2. De-blocheaza coada de printare pentru toate imprimantele Epson (sterge joburi blocate cu eroare)
try {
    Get-Printer | Where-Object { $_.Name -like "*EPSON*" -or $_.Name -like "*Receipt*" } | ForEach-Object {
        Get-PrintJob -PrinterName $_.Name -ErrorAction SilentlyContinue | Where-Object { 
            $_.JobStatus -like "*Error*" -or $_.JobStatus -like "*Blocked*" -or $_.JobStatus -like "*Deleting*" -or $_.JobStatus -like "*PaperOut*"
        } | Remove-PrintJob -ErrorAction SilentlyContinue
    }
} catch {}

$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFOW
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }
    
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPWStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, IntPtr pBytes, Int32 dwCount)
    {
        Int32 dwWritten = 0;
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOW di = new DOCINFOW();
        di.pDocName = "RAW Kiosk Ticket";
        di.pDataType = "RAW";

        if (!OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero))
        {
            int err = Marshal.GetLastWin32Error();
            Console.WriteLine("[WinSpool] OpenPrinter failed (" + szPrinterName + "): error " + err);
            return false;
        }

        bool bSuccess = false;
        try
        {
            if (StartDocPrinter(hPrinter, 1, di))
            {
                if (StartPagePrinter(hPrinter))
                {
                    bSuccess = WritePrinter(hPrinter, pBytes, dwCount, out dwWritten);
                    if (!bSuccess) {
                        Console.WriteLine("[WinSpool] WritePrinter failed: error " + Marshal.GetLastWin32Error());
                    }
                    EndPagePrinter(hPrinter);
                }
                else
                {
                    Console.WriteLine("[WinSpool] StartPagePrinter failed: error " + Marshal.GetLastWin32Error());
                }
                EndDocPrinter(hPrinter);
            }
            else
            {
                int err = Marshal.GetLastWin32Error();
                Console.WriteLine("[WinSpool] StartDocPrinter failed: error " + err);
            }
        }
        finally
        {
            ClosePrinter(hPrinter);
        }
        return bSuccess;
    }

    public static bool SendFileToPrinter(string szPrinterName, string szFileName)
    {
        if (!File.Exists(szFileName)) {
            Console.WriteLine("[WinSpool] Fisier inexistent: " + szFileName);
            return false;
        }
        byte[] bytes;
        using (FileStream fs = new FileStream(szFileName, FileMode.Open, FileAccess.Read))
        using (BinaryReader br = new BinaryReader(fs))
        {
            bytes = br.ReadBytes((int)fs.Length);
        }
        int nLength = bytes.Length;
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(nLength);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, nLength);
        bool bSuccess = SendBytesToPrinter(szPrinterName, pUnmanagedBytes, nLength);
        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        return bSuccess;
    }
}
"@

try {
    if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelper').Type) {
        Add-Type -TypeDefinition $code -Language CSharp
    }
} catch {
    Write-Output "ADD_TYPE_ERROR: $_"
}

$res = [RawPrinterHelper]::SendFileToPrinter($PrinterName, $FilePath)
if ($res) { 
    Write-Output "OK" 
} else { 
    Write-Output "FAIL" 
}

