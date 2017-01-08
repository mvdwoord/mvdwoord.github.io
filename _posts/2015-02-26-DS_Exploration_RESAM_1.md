---
layout: post
title: Datastore exploration in RES Automation Manager – Part 1
category: exploration
tags:
- T-SQL
- RES Automation Manager
- XML
---
Working with RES Automation Manager (AM) you may have experienced some limitations in extracting information about your environment. There is some built-in functionality to generate an “instant report” for some components, but this creates a heavily formatted document, not structured data.

Everything is stored in the Datastore, implemented in an RDBMS such as MS-SQL, DB2, or other (although I have only ever seen these two in production environments). Can we query this directly to reveal some more about the AM environment, and get this data in a format that is structured, for further processing?

<!-- more -->

Before we continue, the official stance of RES software is to never peek, let alone poke in the database. Everything should be done through either the console (GUI / CLI) or the WebAPI. There are however plenty of examples where there is simply no other way than to ‘pop the hood’ and DIY.. sometimes it is even their own advice, be it with assistance from their engineers. This will be the only and last disclaimer on this topic. Use any and all information provided here at your own risk.

Back to business, we wanted to generate some reports about the agents and their properties. Most of these are stored directly in the tblAgents table such as:

| COLUMN         | DESCRIPTION                                                                                                         |
|----------------|---------------------------------------------------------------------------------------------------------------------|
| strName        | This is as you would expect, the common name of the agent as used throughout the application                        |
| WUIDAgent      | Many objects are internally represented with a GUID like identifier, this is the one uniquely identifying an agent. |
| lngStatus      | This indicates an agent’s connectivity status. Value can be 1 (online) or 0 (offline).                              |
| dtmLastContact | This DateTime field holds a timestamp of the last time the agent has contacted the AM environment.                  |
| strOSName      | The name of the operating system of the agent. E.g. “Microsoft Windows Server 2012 R2 Standard”                     |

So far so good, but in our environment we use rules to manage certain team memberships and one of these rules is to match the ‘First Contacted Dispatcher’. This is the dispatcher the agent initially contacted upon registering in the environment and can be of great help in identifying the location or BU the machine belongs to. So I expected this value to be stored alongside the rest of the information in the Agents table; unfortunately there is only a column named strLastDispatcher which seems to hold the WUID for the most recently contacted dispatcher.

Upon some inspection with a SQL profiler, while clicking about in the GUI I noticed the imgInfo field is queried whenever the console processes a rule which filters on the ‘first accessed dispatcher’. The column type for imgInfo is ‘image’ which is defined as ‘Variable-length binary data’. Furthermore this datatype is for ‘storing large non-Unicode and Unicode character and binary data. Unicode data uses the UNICODE UCS-2 character set’. Let’s see what it looks like:

Query:

{% highlight sql %}
SELECT imgInfo FROM tblAgents
{% endhighlight %}

Output (truncated):
<pre>0x3C003F0078006D006C002000760065007200730069006F006E003D00220031002E0030002200200065006E0063006F00640069006E0067003D0022005500540046002D00380022003F003E003C004C0041004E003E003C00410064006100700074006500720020004D00410043003D002200300030003A00300043003A00320039003A00370046003A00330045003A003900460022003E003C00490050003E003C004900500041006400640072006500730073003E003100390032002E003100360038002E0032002E003100350030003C002F004900500041006400640072006500730073003E003C00490050005300750062006E006500</pre>

Since I am not very apt at reading this byte string I tried to translate it to a string value (data type NVARCHAR) as follows:

{% highlight sql %}
SELECT CAST(imgInfo AS NVARCHAR(MAX)) FROM tblAgents
{% endhighlight %}

Output:
`Explicit conversion from data type image to nvarchar(max) is not allowed.`

Not allowed?! Ok so I -> Google -> fiddle -> learn to cast it to a VARBINARY first, and then to a VARCHAR which looks like this:

{% highlight sql %}
SELECT CAST(CAST(imgInfo AS VARBINARY(MAX)) AS NVARCHAR(MAX)) from tblAgents
{% endhighlight %}

Output:

{% highlight xml %}
<?xml version="1.0" encoding="UTF-8"?>
<LAN>
  <Adapter MAC="00:0C:29:7F:3E:9F">
    <IP>
      <IPAddress>192.168.2.150</IPAddress>
      <IPSubnet>255.255.255.0</IPSubnet>
    </IP>
    <IPGateways>
      <IPGateway>192.168.2.2</IPGateway>
    </IPGateways>
  </Adapter>
  <info>
    <FQDN>W2K3TEST-346D0B</FQDN>
    <OS>2003</OS>
    <SP>2</SP>
    <bit>32</bit>
    <ossuite>272</ossuite>
    <ostype>SERVER</ostype>
    <procarch>0</procarch>
    <systeminfo>8425475</systeminfo>
  </info>
  <firstdispatcher>WIN-TTDNUBI9TNA</firstdispatcher>
</LAN>
{% endhighlight %}

That is where the coveted first dispatcher is hiding! What is the other stuff? well pretty much self explanatory I guess. Adapter configuration (TCP/IP) and some OS information on version and edition. Why this is not stored in a column, normalized for common OS information structures, we can only guess. Must be some leftover from days past, but it would seem to me that the additional overhead of processing this xml for each agent doesn’t exactly increase performance. I also see no obvious need for obfuscation or anything along those lines, perhaps we will never know.

The customer wanted a way to query the first accessed dispatcher directly from the database so let’s give that a try. T-SQL provides an XML datatype which can be queried but trying to cast to XML datatype directly produces an error:

`XML parsing: line 1, character 38, unable to switch the encoding`

So Why is this? The original image field contains data encoded as ‘UNICODE UCS-2’ which is effectively UTF-16 (easily spotted by the 0x00 every other byte). The XML declaration explicitly specifies the encoding as UTF-8. So apart from the why (why?) there would be two ways of dealing with this. If possible it would be nice to cast it to UTF-8 encoding, then to XML, but I could not find a way to do this in T-SQL (didn’t look too hard either). Another option is to modify the declaration to UTF-16 before casting to XML.

{% highlight sql %}
SELECT CAST(REPLACE((CAST(CAST(imgInfo AS VARBINARY(MAX)) AS NVARCHAR(MAX))),'UTF-8','UTF-16') AS XML) FROM tblAgents
{% endhighlight %}

Then we can use T-SQL built in XML query functions to get to the ‘firstdispatcher’ element and finally cast that back into a unicode string (NVARCHAR) and name the column FirtsDispatcher for readability.

{% highlight sql %}
SELECT
strName AS AgentName,
CAST(
    CAST(
      REPLACE(
             (CAST(
                  CAST(imgInfo AS VARBINARY(MAX))
                  AS NVARCHAR(MAX))
             ),'UTF-8','UTF-16')
    AS XML).query('data(/LAN/firstdispatcher)')
  AS NVARCHAR(MAX))
AS FirstDispatcher
FROM tblAgents
{% endhighlight %}

<pre>
AgentName           FirstDispatcher
W2K3TEST-346D0B     WIN-TTDNUBI9TNA
WIN-TTDNUBI9TNA     WIN-TTDNUBI9TNA

(2 row(s) affected)
</pre>

Phew! There are some more image fields in the tables worthy of investigation. To be continued..

*P.S. All queries were done against a RES AM 2014 SR2 environment (version 7.0.2.0) running on a single Windows Server 2012 VM hosting the console, dispatcher and datastore. The database is running on Microsoft SQL Server Express (64-bit) – 11.0.5058.0. YMMV etc.*