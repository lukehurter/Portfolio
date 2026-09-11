<#
    Serve the built CPQ interface on localhost, with nothing installed.

    Run "Run CPQ system.bat" rather than this directly.

    WHY A SERVER AT ALL

    The interface is one self-contained HTML file, so for a long time the launcher
    just opened it. Reported: "is the demo bat really just opening the html? That's
    not even a good demo you can't test the pdf exports or anything on that."

    A file:// page is not the app a rep will use. It has no origin, and an origin is
    what the three things a demo most needs to prove are built on:

      the Word export     a blob download, which a page with no origin is not
                          reliably allowed to hand you
      the theme           localStorage, which is per-origin and unavailable to an
                          opaque one
      anything fetched    same-origin by definition, and file:// satisfies no
                          same-origin check

    Serving it on 127.0.0.1 gives it a real origin, so what sales tries is what the
    deployed app does. Printing to PDF works either way; the rest is why this exists.

    WHY TCPLISTENER AND NOT HTTPLISTENER

    HttpListener wants a URL ACL registered, which on a locked-down laptop means an
    administrator. A raw TCP socket on the loopback address needs nothing from
    anybody, and this only ever answers with one file, so the whole server is the
    forty lines below.
#>

param(
    [Parameter(Mandatory = $true)][string]$AppPath,
    [int]$Port = 0
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $AppPath)) {
    Write-Host "  Could not find $AppPath" -ForegroundColor Red
    exit 1
}

$bytes = [System.IO.File]::ReadAllBytes($AppPath)

# Port 0 lets Windows pick a free one, so two people on one machine — or one person
# who left it running yesterday — never collide.
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
$chosen = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$url = "http://127.0.0.1:$chosen/"

Write-Host ""
Write-Host "  Axim CPQ is running at $url" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Sample data. Part numbers and rule wording are real; prices are"
Write-Host "  invented and nothing is saved."
Write-Host ""
Write-Host "  Leave this window open while you use it. Close it when you are done."
Write-Host ""

Start-Process $url | Out-Null

$header = @(
    "HTTP/1.1 200 OK",
    "Content-Type: text/html; charset=utf-8",
    "Content-Length: $($bytes.Length)",
    # Nothing is cached, so a rebuilt file is picked up by a refresh rather than by
    # somebody being told to hard-reload.
    "Cache-Control: no-store",
    "Connection: close",
    "", ""
) -join "`r`n"
$headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            # Read and discard the request. Every path answers with the app: it is a
            # hash router, so there is only ever one document to serve.
            $buffer = New-Object byte[] 8192
            $stream.ReadTimeout = 2000
            try { [void]$stream.Read($buffer, 0, $buffer.Length) } catch { }
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Flush()
        } catch {
            # A browser that hangs up mid-response is normal and is not worth a message.
        } finally {
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}
