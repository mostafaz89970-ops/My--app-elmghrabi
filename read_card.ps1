$winscardDef = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WinSCardReader {
    [DllImport("winscard.dll")]
    public static extern int SCardEstablishContext(uint dwScope, IntPtr pvReserved1, IntPtr pvReserved2, out IntPtr phContext);

    [DllImport("winscard.dll")]
    public static extern int SCardReleaseContext(IntPtr hContext);

    [DllImport("winscard.dll", EntryPoint = "SCardListReadersW", CharSet = CharSet.Unicode)]
    public static extern int SCardListReaders(IntPtr hContext, string mszGroups, byte[] mszReaders, ref int pcchReaders);

    [DllImport("winscard.dll", EntryPoint = "SCardConnectW", CharSet = CharSet.Unicode)]
    public static extern int SCardConnect(IntPtr hContext, string szReader, uint dwShareMode, uint dwPreferredProtocols, out IntPtr phCard, out uint pdwActiveProtocol);

    [DllImport("winscard.dll")]
    public static extern int SCardDisconnect(IntPtr hCard, uint dwDisposition);

    [DllImport("winscard.dll")]
    public static extern int SCardStatusW(IntPtr hCard, byte[] mszReaderNames, ref int pcchReaderLen, out uint pdwState, out uint pdwProtocol, byte[] pbAtr, ref int pcbAtrLen);

    [DllImport("winscard.dll")]
    public static extern int SCardTransmit(IntPtr hCard, IntPtr pioSendPci, byte[] pbSendBuffer, int cbSendLength, IntPtr pioRecvPci, byte[] pbRecvBuffer, ref int pcbRecvLength);
}
'@

try {
    Add-Type -TypeDefinition $winscardDef
} catch {}

$hContext = [IntPtr]::Zero
$res = [WinSCardReader]::SCardEstablishContext(2, [IntPtr]::Zero, [IntPtr]::Zero, [ref]$hContext)

if ($res -ne 0) {
    @{ success = $false; error = "SCardEstablishContext failed: $res" } | ConvertTo-Json -Compress
    exit
}

$pcchReaders = 2048
$readersBuffer = New-Object byte[] $pcchReaders
$resList = [WinSCardReader]::SCardListReaders($hContext, $null, $readersBuffer, [ref]$pcchReaders)

if ($resList -ne 0 -or $pcchReaders -le 1) {
    $null = [WinSCardReader]::SCardReleaseContext($hContext)
    @{ success = $true; readers = @(); cardPresent = $false; message = "No readers detected" } | ConvertTo-Json -Compress
    exit
}

$readersString = [System.Text.Encoding]::Unicode.GetString($readersBuffer, 0, ($pcchReaders - 1) * 2)
$readers = $readersString -split "`0" | Where-Object { $_.Trim().Length -gt 0 }

$cardInfo = $null

foreach ($r in $readers) {
    $hCard = [IntPtr]::Zero
    $activeProtocol = 0
    $resConn = [WinSCardReader]::SCardConnect($hContext, $r, 2, 3, [ref]$hCard, [ref]$activeProtocol)
    
    if ($resConn -eq 0) {
        $atr = New-Object byte[] 36
        $atrLen = 36
        $state = 0
        $proto = 0
        $readerNameBuf = New-Object byte[] 256
        $readerNameLen = 128
        $resStat = [WinSCardReader]::SCardStatusW($hCard, $readerNameBuf, [ref]$readerNameLen, [ref]$state, [ref]$proto, $atr, [ref]$atrLen)
        
        $atrHex = ""
        if ($resStat -eq 0 -and $atrLen -gt 0) {
            $atrHex = ($atr[0..($atrLen - 1)] | ForEach-Object { $_.ToString("X2") }) -join " "
        }

        $uidHex = ""
        $apduGetUid = [byte[]]@(0xFF, 0xCA, 0x00, 0x00, 0x00)
        $recvBuf = New-Object byte[] 258
        $recvLen = 258
        
        $pci = [System.Runtime.InteropServices.Marshal]::AllocHGlobal(8)
        [System.Runtime.InteropServices.Marshal]::WriteInt32($pci, 0, [int]$activeProtocol)
        [System.Runtime.InteropServices.Marshal]::WriteInt32($pci, 4, 8)
        
        $resTx = [WinSCardReader]::SCardTransmit($hCard, $pci, $apduGetUid, $apduGetUid.Length, [IntPtr]::Zero, $recvBuf, [ref]$recvLen)
        if ($resTx -eq 0 -and $recvLen -ge 2) {
            $sw1 = $recvBuf[$recvLen - 2]
            $sw2 = $recvBuf[$recvLen - 1]
            if ($sw1 -eq 0x90 -and $sw2 -eq 0x00 -and $recvLen -gt 2) {
                $uidHex = ($recvBuf[0..($recvLen - 3)] | ForEach-Object { $_.ToString("X2") }) -join ""
            }
        }
        [System.Runtime.InteropServices.Marshal]::FreeHGlobal($pci)

        $null = [WinSCardReader]::SCardDisconnect($hCard, 0)

        $cardInfo = @{
            cardPresent = $true
            reader = $r
            atr = $atrHex
            uid = $uidHex
            protocol = $activeProtocol
        }
        break
    }
}

$null = [WinSCardReader]::SCardReleaseContext($hContext)

if ($cardInfo -ne $null) {
    @{
        success = $true
        readers = $readers
        cardPresent = $true
        card = $cardInfo
    } | ConvertTo-Json -Compress
} else {
    @{
        success = $true
        readers = $readers
        cardPresent = $false
        message = "Readers found but no card inserted"
    } | ConvertTo-Json -Compress
}
