---
layout: post
title: Portscanning in PowerShell
category: tools
tags:   
- Powershell
- RES Automation Manager
- Scripts
---
Talking to someone who is not listening is annoying and a waste of time. If there was a foolproof way to check if the person you’re talking to is actually receptive you can spare yourself the trouble of further communication if they aren’t. In case of an automated workflow it can be useful to know if your intended target service is listening on certain ports and based on the outcome perform certain actions / logging / alerting.

When you are creating workflows with a tool such as RES Automation Manager it would be nice to check one or more TCP ports on any number of target machines and use the outcome as a condition for task execution. Perhaps you are monitoring an unstable WAN connection, or you want to keep an eye out for connection errors between your Domain Controllers..

The following code (and attached RES Automation Manager module) does exactly that. It takes an input string for hosts and ports, sanitizes the input and packs them as an array.
{% highlight powershell %}
$TargetList = "$[Targets]" -replace '\s+', '' -Split ","
$TCPPortList = "$[Ports]" -replace '\s+', '' -Split ","
{% endhighlight %}

Then we set a timeout in milliseconds (paramaterize this if you like), grab the hostname, and initiate a counter for connection timeouts. This counter will also serve as an ExitCode, setting a paramater in the module.

{% highlight powershell %}
$TimeOut = 1000
$ComputerName = [System.Net.Dns]::GetHostName()
$TimeOutCount = 0
{% endhighlight %}

Now we loop through every host and every port and create a socket object:

{% highlight powershell %}
foreach ($Target in $TargetList){
 foreach ($TCPPort in $TCPPortList){
 $Socket = New-Object System.Net.Sockets.Socket([System.Net.Sockets.AddressFamily]::InterNetwork,`
 [System.Net.Sockets.SocketType]::Stream,`
 [System.Net.Sockets.ProtocolType]::Tcp)
{% endhighlight %}

Then comes the meat of the script, we asynchronously try to open the connection and measure how long it takes before either the connection is established or we hit the timeout value.

{% highlight powershell %}
$SyncResult = $Socket.BeginConnect($Target, $TCPPort, $null, $null)
 $Measurement = Measure-Command {
 $Success = $SyncResult.AsyncWaitHandle.WaitOne($TimeOut, $true)
 }
 $ResponseTime = $Measurement.Milliseconds
{% endhighlight %}

Finally we check if the connection was established, produce some pretty (ugh) output, increase the timeout counter if necessary, clean up any unused sockets, close the loops and exit the script. Easy as pie.

{% highlight powershell %}
if (!($Socket.Connected)){
 "$ComputerName`t--> $Target`t`tport: $TCPPort`tConnection Timed Out ($TimeOut ms)."
 $TimeOutCount += 1
 }
 else{
 "$ComputerName`t--> $Target`t`tport: $TCPPort`tConnection Established ($ResponseTime ms)."
 $Socket.Close()
 }
 }
}
Exit($TimeOutCount)
{% endhighlight %}

Now go ahead, be creative, use the email-task and spam the living daylights out of your network provider.. hellyeah.

{% highlight powershell %}
#Input Variables
$TargetList = "$[Targets]" -replace '\s+', '' -Split ","
$TCPPortList = "$[Ports]" -replace '\s+', '' -Split ","
$TimeOut = 1000
$ComputerName = [System.Net.Dns]::GetHostName()
$TimeOutCount = 0
foreach ($Target in $TargetList){
 foreach ($TCPPort in $TCPPortList){
 $Socket = New-Object System.Net.Sockets.Socket([System.Net.Sockets.AddressFamily]::InterNetwork,`
 [System.Net.Sockets.SocketType]::Stream,`
 [System.Net.Sockets.ProtocolType]::Tcp)
 
$SyncResult = $Socket.BeginConnect($Target, $TCPPort, $null, $null)
 $Measurement = Measure-Command {
 $Success = $SyncResult.AsyncWaitHandle.WaitOne($TimeOut, $true)
 }
 $ResponseTime = $Measurement.Milliseconds
 
if (!($Socket.Connected)){
 "$ComputerName`t--> $Target`tport: $TCPPort`tConnection Timed Out ($TimeOut ms)."
 $TimeOutCount += 1
 }
 else{
 "$ComputerName`t--> $Target`tport: $TCPPort`tConnection Established ($ResponseTime ms)."
 $Socket.Close()
 }
 }
}
Exit($TimeOutCount)
{% endhighlight %}

And a [pret-a-importer building block](https://github.com/mvdwoord/AM-Building-Blocks/blob/master/module_portping.xml) for your convenience.