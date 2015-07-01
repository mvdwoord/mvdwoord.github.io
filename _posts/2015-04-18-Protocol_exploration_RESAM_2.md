---
layout: post
title: Protocol exploration in RES Automation Manager – Part 2
category: exploration
tags:
- Networking
- RES Automation Manager
- TCP
---
To gain a better understanding of the communication protocol between agents and dispatchers we can use a couple of different tools. Ideally we capture the communication in bulk and store it in such a way that we can analyze it with a variety of different tools. Using command line tools and scripting will allow us to start and stop the capturing with relative ease so we can set up different usage scenarios and focus on specific interaction. Let's get to work.
<!-- more -->
#####Capturing with tshark
Wireshark comes with a command line tool to analyze existing capture files and perform live capturing from the command line. Let's look at the options I used to gather my samples for this article.

<ul>
  <li><strong>tshark -f "port 3163"</strong><br />
-f filters for port 3163, immediately dropping all other packets.</li>
  <li><strong>-Y "tcp.len>0"</strong><br />
A display filter to drop all packets without a "payload", this hides all the TCP SYN/ACK and reset packets.</li>
  <li><strong>-T fields</strong><br />
Specify the output to fields, this allows us to select the fields we are interested in.</li>
  <li><strong>-e tcp.stream</strong><br />
Stream index, to group all messages in a particular conversation together.</li>
  <li><strong>-e ip.src</strong><br />
The source IP address, so we can see who says what.</li>
  <li><strong>-e frame.time_relative</strong><br />
Elapsed time since the start of capturing. This makes it easy to reconstruct the order later on.</li>
  <li><strong>-e data</strong><br />
The actual data being sent, in a "hexlified" format, this is the most practical format I was able to find. Easy to parse with Python.</li>
  <li><strong>-E separator=;</strong><br />
Defines the field separator.</li>
</ul>

When you run this command, and redirect stdout to a text file, you can still see the amount of packets that are being captured, very practical indeed. So let it run for a while, have some interaction with the agent and open up the text file to see what we’ve got.

####Handshake

Every conversation starts with the exact same sequence of bytes:

<table>
  <tr>
    <th style="width:100px;">Agent</th>
    <th>&nbsp;</th>
    <th style="width:100px;text-align:right;">Dispatcher</th>
  </tr>
  <tr>
    <td colspan="2" style="font-family:monospace;">5B 00 57 00 49 00 53 00 44 00 4F 00 4D 00 56 00
34 00 5D 00</td><td>&nbsp;</td>
  </tr>
  <tr>
    <td>&nbsp;</td><td colspan="2" style="text-align:right;font-family:monospace;">5B 00 4E 00 4F 00 53 00 53 00 4C 00 5D 00 30 00
30 00 30 00 38 00 30 00 30 00 30 00 30 00
</td>
  </tr>
</table>

Which looks an awful lot like UTF-16 and decoded as such starts to make sense:

<table>
  <tr>
    <th style="width:100px;">Agent</th>
    <th>&nbsp;</th>
    <th style="width:100px;text-align:right;">Dispatcher</th>
  </tr>
  <tr>
    <td colspan="2" style="font-family:monospace;">[WISDOMV4]</td><td>&nbsp;</td>
  </tr>
  <tr>
    <td>&nbsp;</td><td colspan="2" style="text-align:right;font-family:monospace;">[NOSSL]00080000</td>
  </tr>
</table>

It looks like the agent announces it wants to speak WISDOMV4 to the dispatcher, which answers that it is configured without SSL. I am not sure what the meaning is of the 00080000 but I assume it might be some sort of a maximum transfer size or something similar. Maybe we will figure this out later on. After this initial "WISDOMV4 Handshake" The agent usually sends out a somewhat larger chunk of data to which the dispatcher responds. I will start analysis based on the CHECKFORCHANGES message which is the most common, sent every few seconds.

####CHECKFORCHANGES
Here is a full dump of all bytes in one of the CHECKFORCHANGES conversations in my test environment:
<table>
  <tr>
    <th style="width:100px;">Agent</th>
    <th>&nbsp;</th>
    <th style="width:100px;text-align:right;">Dispatcher</th>
  </tr>
  <tr>
    <td colspan="2" style="font-family:monospace;">5B 00 57 00 49 00 53 00 44 00 4F 00 4D 00 56 00
34 00 5D 00
</td><td>&nbsp;</td>
  </tr>
  <tr>
    <td>&nbsp;</td><td colspan="2" style="text-align:right;font-family:monospace;">5B 00 4E 00 4F 00 53 00 53 00 4C 00 5D 00 30 00
30 00 30 00 38 00 30 00 30 00 30 00 30 00
</td>
  </tr>

  <tr>
    <td colspan="2" style="font-family:monospace;">01 20 20 20 20 20 20 20 20 20 35 34 34 3C 00 3F
00 78 00 6D 00 6C 00 20 00 76 00 65 00 72 00 73
00 69 00 6F 00 6E 00 3D 00 22 00 31 00 2E 00 30
00 22 00 20 00 65 00 6E 00 63 00 6F 00 64 00 69
00 6E 00 67 00 3D 00 22 00 55 00 54 00 46 00 2D
00 31 00 36 00 22 00 20 00 73 00 74 00 61 00 6E
00 64 00 61 00 6C 00 6F 00 6E 00 65 00 3D 00 22
00 79 00 65 00 73 00 22 00 3F 00 3E 00 0D 00 0A
00 3C 00 57 00 49 00 53 00 44 00 4F 00 4D 00 20
00 57 00 55 00 49 00 44 00 3D 00 22 00 7B 00 36
00 41 00 45 00 32 00 45 00 35 00 42 00 35 00 2D
00 44 00 35 00 43 00 38 00 2D 00 34 00 37 00 32
00 38 00 2D 00 41 00 31 00 30 00 41 00 2D 00 31
00 32 00 45 00 32 00 35 00 42 00 44 00 35 00 46
00 39 00 39 00 35 00 7D 00 22 00 20 00 4A 00 6F
00 62 00 3D 00 22 00 43 00 48 00 45 00 43 00 4B
00 46 00 4F 00 52 00 43 00 48 00 41 00 4E 00 47
00 45 00 53 00 22 00 20 00 4E 00 61 00 6D 00 65
00 3D 00 22 00 57 00 32 00 4B 00 33 00 2D 00 54
00 45 00 53 00 54 00 2D 00 30 00 31 00 22 00 20
00 53 00 65 00 74 00 53 00 74 00 61 00 74 00 75
00 73 00 3D 00 22 00 6E 00 6F 00 22 00 20 00 77
00 64 00 73 00 32 00 77 00 61 00 73 00 3D 00 22
00 35 00 32 00 34 00 32 00 38 00 38 00 22 00 20
00 47 00 6C 00 6F 00 62 00 61 00 6C 00 43 00 68
00 61 00 6E 00 67 00 65 00 47 00 55 00 49 00 44
00 3D 00 22 00 22 00 20 00 41 00 67 00 65 00 6E
00 74 00 42 00 6F 00 75 00 6E 00 64 00 61 00 72
00 79 00 3D 00 22 00 32 00 30 00 31 00 35 00 30
00 33 00 32 00 34 00 30 00 39 00 30 00 33 00 34
00 37 00 2E 00 36 00 30 00 30 00 22 00 20 00 41
00 67 00 65 00 6E 00 74 00 53 00 79 00 73 00 74
00 65 00 6D 00 54 00 79 00 70 00 65 00 3D 00 22
00 32 00 22 00 3E 00 3C 00 2F 00 57 00 49 00 53
00 44 00 4F 00 4D 00 3E 00 0D 00 0A 00
</td><td>&nbsp;</td>
  </tr>
  <tr>
    <td>&nbsp;</td><td colspan="2" style="text-align:right;font-family:monospace;">20 20 20 20 20 20 20 20 31 33 31 32</td>
  </tr>
  <tr>
    <td>&nbsp;</td><td colspan="2" style="text-align:right;font-family:monospace;">FF FE 3C 00 3F 00 78 00 6D 00 6C 00 20 00 76 00
65 00 72 00 73 00 69 00 6F 00 6E 00 3D 00 22 00
31 00 2E 00 30 00 22 00 20 00 65 00 6E 00 63 00
6F 00 64 00 69 00 6E 00 67 00 3D 00 22 00 55 00
54 00 46 00 2D 00 31 00 36 00 22 00 3F 00 3E 00
0D 00 0A 00 3C 00 43 00 48 00 41 00 4E 00 47 00
45 00 53 00 20 00 43 00 6F 00 6D 00 6D 00 75 00
6E 00 69 00 63 00 61 00 74 00 69 00 6F 00 6E 00
49 00 64 00 3D 00 22 00 30 00 30 00 42 00 34 00
30 00 30 00 37 00 44 00 30 00 30 00 37 00 35 00
30 00 30 00 37 00 31 00 30 00 30 00 37 00 35 00
30 00 30 00 36 00 39 00 30 00 30 00 37 00 37 00
30 00 30 00 36 00 36 00 30 00 30 00 36 00 41 00
30 00 30 00 36 00 36 00 30 00 30 00 37 00 31 00
30 00 30 00 36 00 35 00 30 00 30 00 37 00 37 00
30 00 30 00 37 00 35 00 30 00 30 00 36 00 31 00
30 00 30 00 36 00 35 00 30 00 30 00 36 00 35 00
30 00 30 00 36 00 38 00 30 00 30 00 36 00 41 00
30 00 30 00 36 00 35 00 30 00 30 00 37 00 33 00
30 00 30 00 37 00 38 00 30 00 30 00 36 00 33 00
30 00 30 00 36 00 38 00 30 00 30 00 35 00 45 00
30 00 30 00 36 00 34 00 30 00 30 00 37 00 33 00
30 00 30 00 37 00 30 00 30 00 30 00 37 00 43 00
30 00 30 00 37 00 33 00 30 00 30 00 37 00 32 00
30 00 30 00 36 00 31 00 30 00 30 00 36 00 44 00
30 00 30 00 36 00 32 00 30 00 30 00 37 00 39 00
30 00 30 00 36 00 34 00 30 00 30 00 37 00 44 00
30 00 30 00 42 00 35 00 22 00 20 00 47 00 6C 00
6F 00 62 00 61 00 6C 00 43 00 68 00 61 00 6E 00
67 00 65 00 47 00 55 00 49 00 44 00 3D 00 22 00
7B 00 39 00 43 00 36 00 41 00 44 00 36 00 36 00
36 00 2D 00 44 00 32 00 37 00 36 00 2D 00 34 00
34 00 30 00 30 00 2D 00 42 00 31 00 42 00 31 00
2D 00 33 00 33 00 36 00 36 00 45 00 46 00 30 00
38 00 45 00 35 00 36 00 33 00 7D 00 22 00 3E 00
0D 00 0A 00 20 00 20 00 3C 00 47 00 6C 00 6F 00
62 00 61 00 6C 00 50 00 72 00 6F 00 70 00 65 00
72 00 74 00 69 00 65 00 73 00 20 00 67 00 75 00
69 00 64 00 3D 00 22 00 7B 00 42 00 42 00 30 00
42 00 32 00 33 00 32 00 41 00 2D 00 42 00 34 00
31 00 44 00 2D 00 34 00 37 00 38 00 44 00 2D 00
42 00 31 00 44 00 38 00 2D 00 41 00 38 00 30 00
37 00 42 00 37 00 39 00 33 00 44 00 31 00 42 00
32 00 7D 00 22 00 20 00 2F 00 3E 00 0D 00 0A 00
20 00 20 00 3C 00 41 00 67 00 65 00 6E 00 74 00
50 00 72 00 6F 00 70 00 65 00 72 00 74 00 69 00
65 00 73 00 20 00 67 00 75 00 69 00 64 00 3D 00
22 00 7B 00 42 00 33 00 33 00 46 00 45 00 41 00
31 00 45 00 2D 00 31 00 41 00 30 00 38 00 2D 00
34 00 39 00 30 00 41 00 2D 00 39 00 44 00 30 00
36 00 2D 00 45 00 31 00 32 00 38 00 31 00 46 00
45 00 32 00 37 00 43 00 36 00 38 00 7D 00 22 00
20 00 61 00 67 00 65 00 6E 00 74 00 67 00 75 00
69 00 64 00 3D 00 22 00 7B 00 36 00 44 00 33 00
42 00 45 00 30 00 35 00 31 00 2D 00 45 00 32 00
44 00 44 00 2D 00 34 00 39 00 35 00 31 00 2D 00
42 00 30 00 45 00 30 00 2D 00 39 00 44 00 42 00
36 00 44 00 30 00 45 00 37 00 45 00 39 00 37 00
44 00 7D 00 22 00 20 00 2F 00 3E 00 0D 00 0A 00
20 00 20 00 3C 00 55 00 70 00 64 00 61 00 74 00
65 00 73 00 20 00 67 00 75 00 69 00 64 00 3D 00
22 00 7B 00 41 00 32 00 30 00 46 00 33 00 36 00
37 00 37 00 2D 00 46 00 37 00 32 00 32 00 2D 00
34 00 38 00 36 00 46 00 2D 00 41 00 38 00 34 00
44 00 2D 00 41 00 42 00 38 00 34 00 34 00 36 00
41 00 31 00 32 00 32 00 36 00 36 00 7D 00 22 00
20 00 2F 00 3E 00 0D 00 0A 00 20 00 20 00 3C 00
53 00 63 00 68 00 65 00 64 00 75 00 6C 00 65 00
20 00 67 00 75 00 69 00 64 00 3D 00 22 00 7B 00
38 00 39 00 43 00 41 00 36 00 37 00 35 00 42 00
2D 00 38 00 42 00 38 00 46 00 2D 00 34 00 38 00
30 00 41 00 2D 00 39 00 31 00 45 00 44 00 2D 00
34 00 36 00 35 00 39 00 34 00 33 00 31 00 33 00
37 00 34 00 45 00 45 00 7D 00 22 00 20 00 61 00
67 00 65 00 6E 00 74 00 67 00 75 00 69 00 64 00
3D 00 22 00 7B 00 37 00 34 00 37 00 39 00 36 00
44 00 35 00 35 00 2D 00 36 00 34 00 35 00 35 00
2D 00 34 00 33 00 44 00 37 00 2D 00 42 00 44 00
46 00 32 00 2D 00 44 00 43 00 32 00 33 00 35 00
45 00 31 00 30 00 33 00 34 00 31 00 38 00 7D 00
22 00 20 00 2F 00 3E 00 0D 00 0A 00 3C 00 2F 00
43 00 48 00 41 00 4E 00 47 00 45 00 53 00 3E 00
</td>
  </tr>
</table>

So it looks like a bunch more UTF-16 but there is something going on in the first few bytes.

#####Agent Communication
The first byte the agent sends out is 0x01 als known as the SOH or Start of Heading control character. A little history lesson from wikipedia:

>"The transmission control characters were intended to structure a data stream, and to manage re-transmission or graceful failure, as needed, in the face of transmission errors.
The start of heading (SOH) character was to mark a non-data section of a data stream—the part of a stream containing addresses and other housekeeping data. The start of text character (STX) marked the end of the header, and the start of the textual part of a stream."

The STX character, 0x02, is nowhere to be found. In stead we find a series of 0x20 which is the codepoint for a SPACE, followed by some numbers. In our case 0x35 0x34 0x34 which in decimal can be interpreted as 544. After this number it looks like UTF-16 text, which we'll analyse a bit later on. The Total size of the TCP data is 557 bytes so the first 13 bytes seem to function as a preamble and include the length of the message.
<pre>557 - 13 = 544</pre>

#####Dispatcher Communication
The data from the dispatcher looks similar but with a few minor differences. There is also a preamble consisting of 8 SPACE characters and some numbers but the SOH is not there. This preamble is sent out in a separate TCP packet, whereas the preamble from the Agent is sent out in the same packet as the rest of the data. Again, the number corresponds to the size of the rest of the message, in this case 0x31 0x33 0x31 0x32 which translates to 1312. Another difference with the agent are the first two bytes, 0xFF 0xFE which is a BOM or Byte Order Mark. This is used in UTF-16 to indicate endianness. According to the specifications it is optional and I can only guess the difference in behavior is due to the differences in the codebase between the agent and dispatcher. More on that later.

####Decoding the data
In further analyses we can focus on the contents of the message. Decoded as UTF-16 we find that the messaging is done using XML so the full conversation, minus the preambles, decoded and formatted for readability looks like this:

<table>
  <tr>
    <th style="width:100px;">Agent</th>
    <th>&nbsp;</th>
    <th style="width:100px;text-align:right;">Dispatcher</th>
  </tr>
  <tr>
    <td colspan="2" style="font-family:monospace;">[WISDOMV4]</td><td>&nbsp;</td>
  </tr>
  <tr>
    <td>&nbsp;</td><td colspan="2" style="text-align:right;font-family:monospace;">[NOSSL]00080000</td>
  </tr>
  <tr>
    <td colspan="2">{% highlight xml %}
<?xml version="1.0" encoding="UTF-16" standalone="yes"?>
<WISDOM 
    WUID="{6AE2E5B5-D5C8-4728-A10A-12E25BD5F995}" 
    Job="CHECKFORCHANGES" 
    Name="W2K3-TEST-01" 
    SetStatus="no" 
    wds2was="524288" 
    GlobalChangeGUID="" 
    AgentBoundary="20150324090347.600" 
    AgentSystemType="2"
/>{% endhighlight %}</td><td>&nbsp;</td>
  </tr>
<tr>
    <td>&nbsp;</td><td colspan="2">{% highlight xml %}
<?xml version="1.0" encoding="UTF-16"?>
<CHANGES 
    CommunicationId="
    00B4007D007500710075006900770066006A006600710065007700750061
    006500650068006A00650073007800630068005E006400730070007C0073
    00720061006D006200790064007D00B5" 
    GlobalChangeGUID="{9C6AD666-D276-4400-B1B1-3366EF08E563}">
    <GlobalProperties guid="{BB0B232A-B41D-478D-B1D8-A807B793D1B2}" />
    <AgentProperties guid="{B33FEA1E-1A08-490A-9D06-E1281FE27C68}" 
                agentguid="{6D3BE051-E2DD-4951-B0E0-9DB6D0E7E97D}" />
    <Updates guid="{A20F3677-F722-486F-A84D-AB8446A12266}" />
    <Schedule guid="{89CA675B-8B8F-480A-91ED-4659431374EE}" 
         agentguid="{74796D55-6455-43D7-BDF2-DC235E103418}" />
</CHANGES>
{% endhighlight %}</td></tr>
</table>

So definitely a lot going on in this simple and frequently exchanged message. Some of it looks familiar but most of the data will require further investigation and a larger sample size. It might be useful to cross check with the datastore and the trace files generated both by the agent and dispatcher. To be continued..
