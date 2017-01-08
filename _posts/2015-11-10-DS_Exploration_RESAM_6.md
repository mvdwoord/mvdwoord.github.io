---
layout: post
title: Datastore exploration in RES Automation Manager – Part 6
category: exploration
tags:
- T-SQL
- RES Automation Manager
---
It's been a while since the last post, but I wanted to share this pearl in RESAM I came across today with regard to the dispatcher discovery process. There are three settings which dictate the agent's behaviour, but it is more involved than just three switches. As there is only a pdf "instant report" available from the RES console I went down the rabbit hole again to create something more useful.

<!-- more -->
The settings, and their possible options are:

- Dispatcher Discovery
    - Autodetect
    - Use Dispatcher address list
    - Use Dispatcher address list but try autodetect first
- Dispatcher locations
    - Retrieve complete Dispatcher list after discovery
    - Only use discovered dispatchers
- Dispatcher recovery
    - Retry discovery
    - Revert to cached list of all known dispatchers

All of these can be set at the Agent, Team or Global level. The order of inheritance is, as with all settings and variables, Global -> Primary Team -> Agent. The only way to export this information from the console is by creating an instant report which looks like this:

![Dispatcher detection Instant Report](/images/dispatcher_detection_instant_report.png){: .center-image}

As we are now used to, the settings are all stored in binary xml snippets and luckily with a bit of variety to keep it interesting. To sanitize the queries somewhat I use the following function to grab that xml out of the binary field(s):

{% highlight sql %}
USE [RES-AM]
GO
/****** Object:  UserDefinedFunction [dbo].[xml_from_img]    Script Date: 11/10/2015 5:46:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER FUNCTION [dbo].[xml_from_img](@img VARBINARY(MAX))
RETURNS XML
AS 
-- Returns the xml
BEGIN
    DECLARE @xml XML
    SELECT @xml = CONVERT(XML, REPLACE((CAST(CAST(@img AS VARBINARY(MAX)) AS NVARCHAR(MAX))),'UTF-8','UTF-16'))
    RETURN @xml;
END;
{% endhighlight %}

Global settings are stored in the `imgData1` column of the `tblSettings WHERE lngSetting = 13` table/row. We can pull them out once and store them as a variable to use in our query later on. When global settings are not explicitly set, they are omitted from the xml which results in a default value. After you set them however and revert back to the default, there is something in there. A typical snippet looks like this:

{% highlight xml %}
<properties>
  <dispatcherlocation>
    <autodetect>no</autodetect>
    <addresslist>W2K3-TEST-01;WIN-TTDNUBI9TNA</addresslist>
    <recovery>CACHEDLIST</recovery>
  </dispatcherlocation>
</properties>
{% endhighlight %}

So the first confusing thing is that all three settings (discovery, locations and recovery) are stored under a tag called "dispatcherlocation" while in the GUI it is called "Dispatcher Detection". In the snippet above there is no `<retrievecompletelist>` element, meaning it has a default value in this case "yes".

Team settings are stored in the `imgSettings` column of the `tblTeams` table. The XML is more or less the same, only containing values when explicitly set once, otherwise reverting to default. There is however an additional attribute "useglobalsettings" which indicates wether or not the setting is inherited from the Global value (the "Inherit from Global" checkbox in the GUI). This attribute is only used on the `<retrievecompletelist>` and `<autodetect>` elements, the `<recovery>` element can be either `GLOBAL`, `RETRY` or `CACHEDLIST` and if it is missing, it is `GLOBAL` by default. Which does not actually mean global, it means inherit. Got it?

For the agents we need to look at the `imgProperties` column in the `tblAgents` table. Same weirdness applies, and I noticed that the agents store certain values in CAPITALS where the team stores it in lowercase. So to recap:

- 3 settings in 4 fields
- Inconsistent naming between GUI and DB
- Inconsistent naming of db columns
- NULL checking for default values
- Inheritance setting by value OR by attribute
- Inconsistent capitalization

![Facepalm](/images/facepalm_through.png){: .center-image}

 So how do we get some usable data out of this? lots of horrible T-SQL that's how! I cobbled this together - as always use at your own risk, or someone else's for that matter as long as it is not mine :)

{% highlight sql %}
-- Grab Global Values and store in variables
DECLARE @G_Autodetect NVARCHAR(MAX)
DECLARE @G_Dispatcherlist NVARCHAR(MAX)
DECLARE @G_FirstTryAutodetect NVARCHAR(MAX)
DECLARE @G_RetrieveCompleteList NVARCHAR(MAX)
DECLARE @G_Recovery NVARCHAR(MAX)

SET @G_Autodetect = (SELECT CAST(CAST(dbo.xml_from_img(imgData1) AS XML).value('(/properties/dispatcherlocation/autodetect)[1]', 'varchar(5)') AS NVARCHAR(MAX)) FROM tblSettings WHERE lngSetting = 13);
SET @G_Dispatcherlist = (SELECT CAST(CAST(dbo.xml_from_img(imgData1) AS XML).value('(/properties/dispatcherlocation/addresslist)[1]', 'varchar(max)') AS NVARCHAR(MAX)) FROM tblSettings WHERE lngSetting = 13);
SET @G_FirstTryAutodetect = ISNULL((SELECT CAST(CAST(dbo.xml_from_img(imgData1) AS XML).value('(/properties/dispatcherlocation/firsttryautodetect)[1]', 'varchar(max)') AS NVARCHAR(MAX)) FROM tblSettings WHERE lngSetting = 13), 'no');
SET @G_RetrieveCompleteList = ISNULL((SELECT CAST(CAST(dbo.xml_from_img(imgData1) AS XML).value('(/properties/dispatcherlocation/retrievecompletelist)[1]', 'varchar(max)') AS NVARCHAR(MAX)) FROM tblSettings WHERE lngSetting = 13), 'no');
SET @G_Recovery = ISNULL((SELECT CAST(CAST(dbo.xml_from_img(imgData1) AS XML).value('(/properties/dispatcherlocation/recovery)[1]', 'varchar(max)') AS NVARCHAR(MAX)) FROM tblSettings WHERE lngSetting = 13), 'RETRY');

-- Pull information from agents and primary teams and build CTE
WITH SettingsCascade (Agent, Deployed, [T-Inherit-Dispatchers], 
                        [A-Autodetect], [A-Dispatcherlist], [A-FirstTryAutodetect], [T-Inherit-Retrieve], [A-RetrieveCompleteList], [T-Inherit-Recovery], [A-Recovery],
                        [PrimaryTeam], [G-Inherit-Dispatchers], 
                        [T-Autodetect], [T-Dispatcherlist], [T-FirstTryAutodetect], [G-Inherit-Retrieve], [T-RetrieveCompleteList], [G-Inherit-Recovery], [T-Recovery],
                        [G-Autodetect], [G-Dispatcherlist], [G-FirstTryAutodetect], [G-RetrieveCompleteList], [G-Recovery])
AS (
SELECT a.strName AS Agent
    ,CONVERT(VARCHAR, a.dtmDeployedOn, 112) AS Deployed
    ,CASE CAST(CAST(dbo.xml_from_img(a.imgProperties) AS XML).value('(/properties/dispatcherlocation/autodetect/@useglobalsettings)[1]', 'varchar(5)') AS NVARCHAR(MAX))
        WHEN 'no' THEN 'no'
        ELSE 'yes'
    END AS [T-Inherit-Dispatchers]
    ,CAST(CAST(dbo.xml_from_img(a.imgProperties) AS XML).value('(/properties/dispatcherlocation/autodetect)[1]', 'varchar(5)') AS NVARCHAR(MAX)) AS [A-Autodetect]
    ,CAST(CAST(dbo.xml_from_img(a.imgProperties) AS XML).value('(/properties/dispatcherlocation/addresslist)[1]', 'varchar(max)') AS NVARCHAR(MAX)) AS [A-Dispatcherlist]
    ,ISNULL(CAST(CAST(dbo.xml_from_img(a.imgProperties) AS XML).value('(/properties/dispatcherlocation/firsttryautodetect)[1]', 'varchar(max)') AS NVARCHAR(MAX)), 'no') AS [A-FirstTryAutodetect]
    ,CASE CAST(CAST(dbo.xml_from_img(a.imgProperties) AS XML).value('(/properties/dispatcherlocation/retrievecompletelist/@useglobalsettings)[1]', 'varchar(5)') AS NVARCHAR(MAX))
        WHEN 'no' THEN 'no'
        ELSE 'yes'
    END AS [T-Inherit-Retrieve]
    ,ISNULL(CAST(CAST(dbo.xml_from_img(a.imgProperties) AS XML).value('(/properties/dispatcherlocation/retrievecompletelist)[1]', 'varchar(max)') AS NVARCHAR(MAX)), 'yes') AS [A-RetrieveCompleteList]
    ,CASE ISNULL(CAST(CAST(dbo.xml_from_img(a.imgProperties) AS XML).value('(/properties/dispatcherlocation/recovery)[1]', 'varchar(10)') AS NVARCHAR(MAX)), 'GLOBAL')
        WHEN 'GLOBAL' THEN 'yes'
        ELSE 'no'
    END AS [T-Inherit-Recovery]
    ,CAST(CAST(dbo.xml_from_img(a.imgProperties) AS XML).value('(/properties/dispatcherlocation/recovery)[1]', 'varchar(10)') AS NVARCHAR(MAX)) AS [A-Recovery]
    ,t.strName As [PrimaryTeam]
    ,CASE CAST(CAST(dbo.xml_from_img(t.imgSettings) AS XML).value('(/properties/dispatcherlocation/autodetect/@useglobalsettings)[1]', 'varchar(5)') AS NVARCHAR(MAX))
        WHEN 'no' THEN 'no'
        ELSE 'yes'
    END AS [G-Inherit-Dispatchers]
    ,CAST(CAST(dbo.xml_from_img(t.imgSettings) AS XML).value('(/properties/dispatcherlocation/autodetect)[1]', 'varchar(5)') AS NVARCHAR(MAX)) AS [T-Autodetect]
    ,CAST(CAST(dbo.xml_from_img(t.imgSettings) AS XML).value('(/properties/dispatcherlocation/addresslist)[1]', 'varchar(max)') AS NVARCHAR(MAX)) AS [T-Dispatcherlist]
    ,ISNULL(CAST(CAST(dbo.xml_from_img(t.imgSettings) AS XML).value('(/properties/dispatcherlocation/firsttryautodetect)[1]', 'varchar(max)') AS NVARCHAR(MAX)), 'no') AS [T-FirstTryAutodetect]
    ,CASE CAST(CAST(dbo.xml_from_img(t.imgSettings) AS XML).value('(/properties/dispatcherlocation/retrievecompletelist/@useglobalsettings)[1]', 'varchar(5)') AS NVARCHAR(MAX))
        WHEN 'no' THEN 'no'
        ELSE 'yes'
    END AS [G-Inherit-Retrieve]
    ,ISNULL(CAST(CAST(dbo.xml_from_img(t.imgSettings) AS XML).value('(/properties/dispatcherlocation/retrievecompletelist)[1]', 'varchar(max)') AS NVARCHAR(MAX)), 'yes') AS [T-RetrieveCompleteList]
    ,CASE ISNULL(CAST(CAST(dbo.xml_from_img(t.imgSettings) AS XML).value('(/properties/dispatcherlocation/recovery)[1]', 'varchar(10)') AS NVARCHAR(MAX)), 'GLOBAL')
        WHEN 'GLOBAL' THEN 'yes'
        ELSE 'no'
    END AS [G-Inherit-Recovery]
    ,CAST(CAST(dbo.xml_from_img(t.imgSettings) AS XML).value('(/properties/dispatcherlocation/recovery)[1]', 'varchar(10)') AS NVARCHAR(MAX)) AS [T-Recovery]
    ,@G_Autodetect AS [G-Autodetect]
    ,@G_Dispatcherlist AS [G-Dispatcherlist]
    ,@G_FirstTryAutodetect AS [G-FirstTryAutodetect]
    ,@G_RetrieveCompleteList AS [G-RetrieveCompleteList]
    ,@G_Recovery AS [G-Recovery]

FROM tblAgents as a
LEFT JOIN tblTeams as t
ON a.PrimaryTeamGUID = t.GUID
)

SELECT Agent
        ,Deployed
        , CASE [T-Inherit-Dispatchers]
            WHEN  'no' THEN 'Agent'
            ELSE CASE [G-Inherit-Dispatchers]
                    WHEN 'no' THEN 'Team'
                    ELSE 'Global'
                END
            END AS [Source-Discovery]
        , CASE [T-Inherit-Dispatchers]
            WHEN  'no' THEN [A-Autodetect] 
            ELSE CASE [G-Inherit-Dispatchers]
                    WHEN 'no' THEN [T-Autodetect]
                    ELSE [G-Autodetect]
                END
            END AS Autodetect           
        , CASE [T-Inherit-Dispatchers]
            WHEN  'no' THEN [A-Dispatcherlist] 
            ELSE CASE [G-Inherit-Dispatchers]
                    WHEN 'no' THEN [T-Dispatcherlist]
                    ELSE [G-Dispatcherlist]
                END
            END AS Dispatchers
        , CASE [T-Inherit-Dispatchers]
            WHEN  'no' THEN [A-FirstTryAutodetect] 
            ELSE CASE [G-Inherit-Dispatchers]
                    WHEN 'no' THEN [T-FirstTryAutodetect]
                    ELSE [G-FirstTryAutodetect]
                END
            END AS FirstTryAutoDetect
        , CASE [T-Inherit-Retrieve]
            WHEN  'no' THEN 'Agent'
            ELSE CASE [G-Inherit-Retrieve]
                    WHEN 'no' THEN 'Team'
                    ELSE 'Global'
                END
            END AS [Source-Locations]
        , CASE [T-Inherit-Retrieve]
            WHEN  'no' THEN [A-RetrieveCompleteList] 
            ELSE CASE [G-inherit-Retrieve]
                    WHEN 'no' THEN [T-RetrieveCompleteList]
                    ELSE [G-RetrieveCompleteList]
                END
            END AS RetrieveCompleteList
        , CASE [T-Inherit-Recovery]
            WHEN  'no' THEN 'Agent'
            ELSE CASE [G-Inherit-Recovery]
                    WHEN 'no' THEN 'Team'
                    ELSE 'Global'
                END
            END AS [Source-Recovery]
        , CASE [T-Inherit-Recovery]
            WHEN  'no' THEN [A-Recovery] 
            ELSE CASE [G-Inherit-Recovery]
                    WHEN 'no' THEN [T-Recovery]
                    ELSE [G-Recovery]
                END
            END AS Recovery
 FROM SettingsCascade
 ORDER by Agent;
{% endhighlight %}

Now there is an awful lot of code duplication there. It might be possible to abstract some of it away, optimize it a bit but unfortunately I have to run this on an old version of SQL server which does not have fancy stuff like `IIF`. Besides I am glad this monster works and will gladly not look much longer at the RESAM innards. The query gives me the following results for my test environment:

<table>
  <tr>
    <th>Agent</th>
    <th>Source-Discovery</th>
    <th>Autodetect</th>
    <th>Dispatchers</th>
    <th>FirstTryAutoDetect</th>
    <th>Source-Locations</th>
    <th>RetrieveCompleteList</th>
    <th>Source-Recovery</th>
    <th>Recovery</th>
  </tr>
  <tr>
    <td>OC6252136410</td>
    <td>Global</td>
    <td>no</td>
    <td>W2K3-TEST-01;WIN-TTDNUBI9TNA</td>
    <td>no</td>
    <td>Global</td>
    <td>yes</td>
    <td>Global</td>
    <td>RETRY</td>
  </tr>
  <tr>
    <td>W2K3-TEST-01</td>
    <td>Agent</td>
    <td>yes</td>
    <td>W2K3-TEST-01;WIN-TTDNUBI9TNA</td>
    <td>NO</td>
    <td>Global</td>
    <td>yes</td>
    <td>Global</td>
    <td>RETRY</td>
  </tr>
  <tr>
    <td>WIN-TTDNUBI9TNA</td>
    <td>Agent</td>
    <td>no</td>
    <td>W2K3-TEST-01;WIN-TTDNUBI9TNA</td>
    <td>yes</td>
    <td>Agent</td>
    <td>yes</td>
    <td>Global</td>
    <td>RETRY</td>
  </tr>
</table>

I have purposefully split the "autodetect" and "dispatcher list" into separate fields so it is possible to filter and sort on them. To verify the results, this is the overview of the agent settings in the console:

![Agent Settings Overview](/images/agent_settings_overview.png){: .center-image}

Now why does it say Global as source in my query results where it says Team in the console? It was the final confusion of the day. It is because the console states the source as Team whenever there is a primary team set for an agent, even though that team is set to inherit the global value. Now that is not incorrect per se, it's just incomplete. And stupid.
