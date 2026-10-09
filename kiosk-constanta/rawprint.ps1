param (
    [Parameter(Mandatory=$true)][string]$PrinterName,
    [Parameter(Mandatory=$true)][string]$FilePath
)

# 1. Auto-resolve exact installed printer name & fallback if in Error
try {
    $allPrinters = @(Get-Printer)

    # Excludem categoric dispozitivele virtuale sau cele pe port NUL: (Coupon Generator, PDF, XPS etc.)
    $validPrinters = $allPrinters | Where-Object {
        $name = $_.Name
        $port = $_.PortName
        ($port -ne "NUL:" -and $port -ne "NUL" -and $port -notlike "FILE*" -and $port -notlike "PORTPROMPT*") -and
        ($name -notlike "*Coupon*" -and $name -notlike "*Generator*" -and $name -notlike "*PDF*" -and $name -notlike "*XPS*" -and $name -notlike "*Fax*" -and $name -notlike "*OneNote*")
    }

    $target = $validPrinters | Where-Object { $_.Name -eq $PrinterName }
    
    # Comutam DOAR daca imprimanta curenta e intr-o stare reala de Error sau Offline
    # (ATENTIE: PrinterStatus 2 = Unknown si 3 = Idle pe Windows WMI, sunt stari NORMALE pentru Epson APD!)
    $isRealError = $target -and ($target.PrinterStatus -eq "Error" -or $target.PrinterStatus -eq "Offline")
    if ($target -and $isRealError) {
        $healthy = $validPrinters | Where-Object { 
            ($_.Name -like "*EPSON*" -or $_.Name -like "*Receipt*") -and 
            $_.Name -ne $PrinterName -and 
            $_.PrinterStatus -ne "Error" -and $_.PrinterStatus -ne "Offline"
        } | Select-Object -First 1
        if ($healthy) {
            Write-Output "[WinSpool] Comut de la '$PrinterName' (Eroare) la '$($healthy.Name)'"
            $PrinterName = $healthy.Name
        }
    }
    
    if (-not ($validPrinters.Name -contains $PrinterName)) {
        # Cautam dupa Receipt6 sau TM-T fizic din lista valida
        $matched = $validPrinters | Where-Object { 
            ($_.Name -like "*$PrinterName*" -or 
            $PrinterName -like "*$($_.Name)*" -or 
            ($_.Name -like "*Receipt6*") -or
            ($_.PortName -like "TMUSB*" -or $_.PortName -like "USB*") -or
            ($_.Name -like "*EPSON*" -and $_.Name -like "*Receipt*") -or
            ($_.Name -like "*EPSON*" -and $_.Name -like "*TM*")) -and
            $_.PrinterStatus -ne "Error" -and $_.PrinterStatus -ne "Offline"
        } | Select-Object -First 1
        if ($matched) {
            $PrinterName = $matched.Name
        }
    }
} catch {}

# 2. De-blocheaza complet coada de printare si asigura ca imprimanta nu este pe Paused
try {
    if ($PrinterName) {
        Set-Printer -Name $PrinterName -Paused $false -ErrorAction SilentlyContinue
        Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 200
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
    Write-Output "OK:$PrinterName" 
} else { 
    Write-Output "FAIL:$PrinterName" 
}

