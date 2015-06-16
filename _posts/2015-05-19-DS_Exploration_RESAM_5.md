---
layout: post
title: Datastore exploration in RES Automation Manager – Part 5
category: exploration
tags:
- T-SQL
- RES Automation Manager
---
Working on a little dashboard / status report for AM I wanted to include some information on the dispatchers. Most of it is straightforward stuff from the tblDispatchers table but I found another one of these RES peculiarities. Some of the settings for a dispatcher can be defined at a global level (Infrastructure -> Datastore -> Settings -> Global Settings) which can be overridden for a specific dispatcher (Dispatcher Properties -> Settings). So how can we include the effective setting straight from SQL?
<!-- more -->

####Dispatcher Settings
The tblDispatchers table has a column called imgProperties which can be NULL or holds some xml-encoded-as-image. It seems the default is NULL which means all settings are inherited from the global level. Whenever you override something it will contain these settings, so let's enable the WebAPI on a dispatcher and have a look:
{% highlight sql %}
SELECT  CAST(
    REPLACE(
        (CAST(CAST(imgProperties AS VARBINARY(MAX)) AS NVARCHAR(MAX)))
        ,'UTF-8','UTF-16')
    AS XML)
FROM tblDispatchers
{% endhighlight %}
The results are somewhat predictable:
{% highlight xml %}
<properties>
  <dispatcherwebapi>
    <state>ENABLED</state>
  </dispatcherwebapi>
</properties>
{% endhighlight %}

The possible values for the state are: ENABLED \| DISABLED \| GLOBAL so the settings can either explicitly or implicitly inherit from global. Ok. Same for the "Protocol Encryption Dispatcher" setting?

{% highlight xml %}
<properties>
  <protocolencryptiondispatcher>GLOBAL</protocolencryptiondispatcher>
</properties>
{% endhighlight %}

Well, yes.. more or less.

####Global Settings
So where are the global settings stored? in the tblSettings table of course! To be more specific in an entry in the tblSettings table with lngSetting = 13 which has another xml-encoded-as-image thing called imgData1. After installation this thing contains:
{% highlight xml %}
<properties>
  <dispatchercache>
    <timing>ONDEMAND</timing>
  </dispatchercache>
  <launchwindow>10080</launchwindow>
  <variablescontainer>
    <categories />
    <variables />
  </variablescontainer>
</properties>
{% endhighlight %}

Ignoring the global variables which are conveniently also stored in this thing, there are two properties explicitly defined and apparently the rest is some sort of application default. The dispatchercache timing can be switched to PRELOAD. So far so good, but when you enable a launch window the launchwindow thing remains 10080 but this is added:

{% highlight xml %}
  <timetype />
  <launchwindowrestictions>
    <launchwindow>
      <enabled>yes</enabled>
      <windowrestrictions>FFC00003FFFFFFC00003FFFFFFC00003FFFFFFFFC00001FFFFFFC00001FFFFFFC00001FFFFFFFFFFFFFF</windowrestrictions>
      <timetype>1</timetype>
    </launchwindow>
  </launchwindowrestictions>
{% endhighlight %}

Yeah, interesting. The timetype seems to be there twice, once abandoned, and once in use. But I am not 100% sure, there is only so much of this my brain can handle on any given day. The windowrestrictions thing I deciphered some time ago, Can't remember the specifics but it was binary flags per 15 or 30 minute period or something like that. Anyway back to our WebAPI and encryption settings. Once you have explicitly defined them there wil be xml elements in the global settings:

{% highlight xml %}
  <dispatcherwebapi>
    <state>DISABLED</state>
  </dispatcherwebapi>
  <protocolencryptiondispatcher>DISABLED</protocolencryptiondispatcher>
{% endhighlight %}

####SQL Query logic
So how do we make sense of all of this in SQL? As far as I could tell with a bit of testing we can make use of the behavior of the XML query capabilities in T-SQL to make our life a bit easier. First we look at the the dispatcher setting xml. If it is either epxlicitly ENABLED or DISABLED it is overriding global settings, otherwise it will be GLOBAL or the setting will not be there. Either way we will need to look at the global settings xml. If teh global setting is ENABLED then it is enabled, otherwise it is either DISABLED or absent. In both cases the setting is efectively disabled. Combine this with some other information in the tblDispatchers table and this should do the trick:

{% highlight sql %}
SELECT  strName AS [Server],
    CASE lngStatus
      WHEN 0 THEN 'Offline'
      WHEN 1 THEN 'Online'
      ELSE 'Unknown'
    END AS [Status],
    strVersion AS [Version],
    CASE
         WHEN Dispatchers.Strosname LIKE '%Windows%2003%' THEN 'Windows 2003'
         WHEN Dispatchers.Strosname LIKE '%Windows%2008%' THEN 'Windows 2008'
         WHEN Dispatchers.Strosname LIKE '%Windows%2012%' THEN 'Windows 2012'
         ELSE 'Unknown'
    END                             AS OSVersion,
    CONVERT(varchar(10), CONVERT(date, dtmDeployedOn, 120)) AS Deployed,
    CONVERT(varchar(10), CONVERT(date, dtmLastContact, 120)) AS Lastcontact,
      CASE CAST(CAST(
         REPLACE((CAST(CAST(imgProperties AS VARBINARY(MAX)) AS NVARCHAR(MAX))),'UTF-8','UTF-16')
         AS XML).query('data(/properties/dispatcherwebapi/state)')
         AS NVARCHAR(MAX))

         WHEN 'ENABLED' Then 'Enabled'
         WHEN 'DISABLED' THEN 'Disabled'
         ELSE CASE (SELECT CAST(CAST(
              REPLACE((CAST(CAST(imgData1 AS VARBINARY(MAX)) AS NVARCHAR(MAX))),'UTF-8','UTF-16')
              AS XML).query('data(/properties/dispatcherwebapi/state)') AS NVARCHAR(MAX))
            FROM tblSettings
            WHERE lngSetting = 13)
            WHEN 'ENABLED' THEN 'Enabled (G)'
            ELSE 'Disabled (G)'
            END
     END AS [WebAPI],
     CASE CAST(CAST(
         REPLACE((CAST(CAST(imgProperties AS VARBINARY(MAX)) AS NVARCHAR(MAX))),'UTF-8','UTF-16')
         AS XML).query('data(/properties/protocolencryptiondispatcher)')
         AS NVARCHAR(MAX))

         WHEN 'ENABLED' Then 'Enabled'
         WHEN 'DISABLED' THEN 'Disabled'
         ELSE CASE (SELECT CAST(CAST(
              REPLACE((CAST(CAST(imgData1 AS VARBINARY(MAX)) AS NVARCHAR(MAX))),'UTF-8','UTF-16')
              AS XML).query('data(/properties/protocolencryptiondispatcher)') AS NVARCHAR(MAX))
            FROM tblSettings
            WHERE lngSetting = 13)
            WHEN 'ENABLED' THEN 'Enabled (G)'
            ELSE 'Disabled (G)'
            END
    END AS [Encryption]

FROM tblDispatchers AS Dispatchers
ORDER BY Server
{% endhighlight %}

<table>
  <tr>
    <th>Server</th>
    <th>Status</th>
    <th>OSVersion</th>
    <th>Lastcontact</th>
    <th>WebAPI</th>
    <th>Encryption</th>
  </tr>
  <tr>
    <td>W2K3-TEST-01</td>
    <td>Offline</td>
    <td>Windows 2003</td>
    <td>2015-05-18</td>
    <td>Disabled (G)</td>
    <td>Disabled</td>
  </tr>
  <tr>
    <td>W2K12-TEST-01</td>
    <td>Online</td>
    <td>Windows 2012</td>
    <td>2015-05-20</td>
    <td>Enabled</td>
    <td>Disabled (G)</td>
  </tr>
</table>

Please note I removed two columns for readability.

####Conclusion
As I have shown in previous posts, RES has many ways to store information and it is not very consistent in using them. There seems to be quite some legacy stuff lingering throughout the database as well as frequent use of default values. These are all for you to find out, so basically you buy a piece of software and they throw in a bunch of puzzles at no additional cost! I hope I did not overlook any specific situation, so as always: test before you trust.