---
layout: post
title: Protocol exploration in RES Automation Manager – Part 1
category: exploration
tags:
- Networking
- RES Automation Manager
- TCP
---
Dispatchers and consoles talk directly to the database, using standard DB clients. In the case of MS SQL Server, used in the vast majority of implementations, this is the SQL Native Client (SQLNCLI). Protocol details are not of much interest, since we can run a profiler on the SQL server to see exactly what queries are performed.
According to the Administration Guide:

>The Agent contacts the Dispatcher at regular intervals. If a new Job is available, the Agent will download all necessary data from the Dispatcher and perform the Job.

Great, but how does this communication work? What does a conversation between an agent and a dispatcher look like?

<!-- more -->

##### Interactive Agent
The agent executable accepts the **/interactive** parameter which starts the agent with a GUI. This can be used to switch RES AM envropnment connections but it also shows Current Activity indicating it is sending messages to the dispatcher. When the agent is idle it usually just shows this:

![Current activity]({{site.url}}/images/current_activity.png)

So the agent sends out a CHECKFORCHANGES message every few seconds, which makes perfect sense. During startup, and when a job is executed you see many different types of messages flying past. Unfortunately the GUI updates rather quickly and does not seem to show or keep any history.

##### Trace-file
Next stop is the logging and tracing built into the product. The logfile and Windows Application Event-log do not show many interesting things but in the registry you can enable a detailed trace of any RES AM component. You simply specify Trace and TraceDetailed as well as a location for the file. It uses rotational logging to a file with a fixed size of 2 MB. Loading the trace-file in excel let’s you analyse the information with relative ease. Split the columns on tabs and split the [Info] column on a semicolon to give you detailed information on the agents activity. This sequence shows up regularly and seems to correspond with the CHECKFORCHANGES message being sent out:

<table>
  <tr>
    <th>Source</th>
    <th>Data</th>
  </tr>
  <tr>
    <td>frmMain.tmrScheduler_Timer</td>
    <td>Begin</td>
  </tr>
  <tr>
    <td>frmMain.tmrScheduler</td>
    <td>Checking for jobs to process (jobcount = '0')</td>
  </tr>
  <tr>
    <td>frmMain.tmrScheduler</td>
    <td>mysnFreshBoot = 'no'</td>
  </tr>
  <tr>
    <td>frmMain.tmrScheduler</td>
    <td>mysnFirstTimeScheduleRetrieved = 'no'</td>
  </tr>
  <tr>
    <td>frmMain.tmrScheduler</td>
    <td>mysnComputerResumed = 'no'</td>
  </tr>
  <tr>
    <td>frmMain.tmrScheduler</td>
    <td>mysnComputerResumedScheduleRetrieved = 'no'</td>
  </tr>
  <tr>
    <td>frmMain.tmrScheduler_Timer</td>
    <td>End</td>
  </tr>
</table>

This is kind of boring, what else is in there? Scheduling a simple module on the agent and applying some filtering on the columns we can extract a variety of messages being sent:

<table>
  <tr>
    <th>Source</th>
    <th>Data</th>
  </tr>
  <tr>
    <td>frmMain.ctlComm.IPPortS_Connected</td>
    <td>Begin (192.168.2.110)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (CHECKCSN)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (CHECKFORCHANGES)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (CHECKFORUPDATES)</td>
  </tr>
  <tr>
    <td>modMain.fysnIsFormLoaded</td>
    <td>Begin (Form: frmDiscoverDispatchers)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (GETDISPATCHERLIST)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (GETGLOBALPROPERTIES)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (GETIDMETHOD)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (GETJOBDETAILS)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (GETPROPERTIES)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (GETSCHEDULEOVERVIEW)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (LOGON)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (SETJOBCURRENTACTIVITY)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (SETJOBSTATUS)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (SETLOG)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (SETLOGGEDONUSER)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (SETQUERYIMAGE)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (SETQUERYRESULTS)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (SETWTCOFFSET)</td>
  </tr>
  <tr>
    <td>frmDiscoverDispatchers.ctlComm.SendMessage</td>
    <td>Begin (WHOAREYOU1)</td>
  </tr>
</table>

Now that's more like it! We see some different messages being sent, mainly from the frmMain.ctlComm.SendMessage source which seems to be the shared class/method for network communication. However, even if we look at all the details in the trace-file for any particular message, we only see information like this:

<table>
  <tr>
    <th>Source</th>
    <th>Data</th>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Begin (SETJOBSTATUS)</td>
  </tr>
  <tr>
    <td>modMain.flngSetJobStatus</td>
    <td>Start</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendMessage</td>
    <td>Start Sending Message</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendData</td>
    <td>Begin</td>
  </tr>
  <tr>
    <td>sharedWisdomFunctions.flngDetermineMaxSpeed</td>
    <td>Agent Speed: 524288 vs Dispatcher Speed: 524288</td>
  </tr>
  <tr>
    <td>sharedWisdomFunctions.flngDetermineMaxSpeed</td>
    <td>End (Return: 524288)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendData</td>
    <td>Segment</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendData</td>
    <td>Block Send OK (994 Bytes send)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.SendData</td>
    <td>End (994 / 994)</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.IPPortS_DataIn</td>
    <td>First package</td>
  </tr>
  <tr>
    <td>sharedFileOperations.fstrGetTempFile</td>
    <td>Return: "C:\WINDOWS\TEMP\wis7E8.tmp"</td>
  </tr>
  <tr>
    <td>frmMain.ctlComm.IPPortS_DataIn</td>
    <td>All packages received (4 bytes)</td>
  </tr>
</table>

We get quite a bit of information but not the contents of the messages. So the trace-file definitely helps in understanding the functioning of the agent but to figure out the protocol we need to dig a little deeper.

#### Protocol Characteristics
>RES Automation Manager uses port 3163 (TCP/UDP) for communication between Agents and Dispatchers. This port is hard-coded and cannot be changed.

Both TCP and UDP port 3163 are registered as RES-SAP protocol with IANA. According to the documentation, UDP is only used for discovery / broadcasting. That may be interesting down the line but let's start the investigation with TCP.

##### Network sniffing with Wireshark
Using Wireshark we can quickly confirm that the dispatcher receives regular traffic on TCP port 3163 from the agent(s). Start capturing on the dispatcher with a rule <strong>tcp.port == 3163</strong> to filter out all the noise. A common exchange we see with an idle agent is this:

<table>
  <tr>
    <th>&nbsp;</th>
    <th>Len</th>
    <th>Info</th>
  </tr>
  <tr>
    <td>TCP</td>
    <td>66</td>
    <td>2765 > 3163 [SYN] Seq=0 Win=65535 Len=0 MSS=1460 WS=2 SACK_PERM=1</td>
  </tr>
  <tr>
    <td>TCP</td>
    <td>66</td>
    <td>3163 > 2765 [SYN, ACK] Seq=0 Ack=1 Win=8192 Len=0 MSS=1460 WS=256 SACK_PERM=1</td>
  </tr>
  <tr>
    <td>TCP</td>
    <td>60</td>
    <td>2765 > 3163 [ACK] Seq=1 Ack=1 Win=122880 Len=0</td>
  </tr>
  <tr>
    <td>TCP</td>
    <td>74</td>
    <td>2765 > 3163 [PSH, ACK] Seq=1 Ack=1 Win=122880 Len=20</td>
  </tr>
  <tr>
    <td>TCP</td>
    <td>84</td>
    <td>3163 > 2765 [PSH, ACK] Seq=1 Ack=21 Win=65536 Len=30</td>
  </tr>
  <tr>
    <td>TCP</td>
    <td>687</td>
    <td>2765 > 3163 [PSH, ACK] Seq=21 Ack=31 Win=122850 Len=633</td>
  </tr>
  <tr>
    <td>TCP</td>
    <td>66</td>
    <td>3163 > 2765 [PSH, ACK] Seq=31 Ack=654 Win=65024 Len=12</td>
  </tr>
  <tr>
    <td>TCP</td>
    <td>618</td>
    <td>3163 > 2765 [PSH, ACK] Seq=43 Ack=654 Win=65024 Len=564</td>
  </tr>
  <tr>
    <td>TCP</td>
    <td>60</td>
    <td>2765 > 3163 [ACK] Seq=654 Ack=607 Win=122274 Len=0</td>
  </tr>
  <tr>
    <td>TCP</td>
    <td>60</td>
    <td>2765 > 3163 [RST, ACK] Seq=654 Ack=607 Win=0 Len=0</td>
  </tr>
</table>

Quintessential TCP handshake, some data flowing back and forth and the connection ends rather impolitely with the agent sending a RST/ACK. I say impolitely because according to the RFC a TCP connection should end with a two way FIN/ACK handshake. This normal termination also requires the connection to remain in a TIME-WAIT state for a significant period and therefore it is quite common to end it a bit more abrupt with a reset. This immediately discards the connection state freeing up resources, simple common sense really.

##### TCP stream contents
Although many different protocols are automatically recognized by Wireshark and can be explored in the lower pane, there is no built in dissector for the RES-SAP protocol.
Wireshark has a function called "follow tcp stream" which allows you to view a sequence of packets like this to be viewed in several different ways and opening this up does show us the contents of the communication:

[![RAW TCP Stream]({{site.url}}/images/tcp_stream_raw.png)]({{site.url}}/images/tcp_stream_raw.png)

So there we have it, the actual message being sent and the response from the dispatcher. Not exactly scintillating conversation but it does give us a peek under the hood of RES AM agent-dispatcher communication. Nothing spectacular, and definitely not very practical to explore all these packages manually this way, therefore this post is titled "part 1".