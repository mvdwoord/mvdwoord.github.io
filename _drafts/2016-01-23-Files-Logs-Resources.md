---
layout: post
title: Files stored in RES Automation Manager
category: exploration
tags:
- T-SQL
- RES Automation Manager
- ZLIB
- Powershell
---
There are several types of files stored in the data store of RESAM. Resources, logfiles and components. I will show you how each of these are stored internally, and try to manipulate them directly, without using the console GUI.

### Resources

Most obvious are the resources, files you can store in the database to be used in modules. A resource can be a single file, or a collection of files which is called a resource package in RES terminology. Single files can also be located on a fileshare but that is less interesting for now.
The database contains a table called `tblResources` which holds information on these types of files. There are some of the usual columns in here with timestamps, CRC, comments etc. More interesting columns are:

- `lngType`, I have found this value to be:
    - `0` for files stored in the datastore
    - `1` for files located on a fileshare
    - `3` for resource packages
- `FolderGUID` is a reference to the `tblFolders` table. It is a self referencing table which holds the folder structure as presented in the console GUI.
- `imgInfo` is some binarified XML with additional settings. More about this below.
- `FileGUID` is a reference to the `GUID` column in the tblFiles table which holds the actual bytes for the resource.

The following query shows you a somewhat readable overview of the resources in your AM evironment:
{% highlight sql %}
IF OBJECT_ID('tempdb..#FolderPaths') IS NOT NULL DROP TABLE #FolderPaths;

WITH Paths([Level], [FullPath], [ID]) AS 
(
    SELECT 
        0 AS [Level], 
        CAST(strName AS VARCHAR(MAX)) AS FullPath, 
        FolderGUID
    FROM tblFolders
    WHERE (ParentFolderGUID IS NULL)

    UNION ALL

    SELECT 
        p.[Level] + 1 AS [Level], 
        CASE RIGHT(p.[FullPath], 1) 
        WHEN '\' THEN CAST(p.[FullPath] + c.[strName] AS VARCHAR(MAX))
        ELSE CAST(p.[FullPath] + ' \ ' + c.[strName]  AS VARCHAR(MAX))
    END AS FullPath, 
    c.FolderGUID
    FROM tblFolders AS c
    INNER JOIN Paths AS p ON p.ID = c.ParentFolderGUID
)
SELECT [FullPath], [ID]
INTO #FolderPaths
FROM Paths

SELECT  ISNULL(Folder.FullPath, '') AS [Path],
        strFileName AS [FileName],
        CASE lngType
            WHEN 0 THEN 'File in Datastore'
            WHEN 1 THEN 'File on Fileshare'
            WHEN 3 THEN 'Resource Pacakge'
        END AS [Type],
        strCRC32,
        dbo.xml_from_img(imgInfo) AS imgInfo,
        strFileSize,
        FileGUID
FROM tblResources
LEFT JOIN #FolderPaths Folder ON FolderGUID = Folder.ID 
ORDER BY Folder.FullPath, [FileName]
{% endhighlight %}
The helper table to grab the full folder paths can be used throughout AM, whenever objects are organized in a folder structure.

#### imgInfo

I use some helper functions throughout my quests around the data store and the dbo.xml_from_img I use to transofrm these binary blobs of XML into a proper XML data type.

{% highlight sql %}
CREATE FUNCTION [dbo].[xml_from_img](@img VARBINARY(MAX))
RETURNS XML
AS 
-- Returns the xml
BEGIN
    DECLARE @xml XML
    SELECT @xml = CONVERT(XML, REPLACE((CAST(CAST(@img AS VARBINARY(MAX)) AS NVARCHAR(MAX))),'UTF-8','UTF-16'))
    RETURN @xml;
END;
{% endhighlight %}

A typical `imgInfo` field for a type `0` resource contains the settings corresponding to the special actions `Parse variables, parameters and functions in the contents of this file` and `Skip parsing of environment variables` checkboxes on the properties tab of the Add/Edit Resource dialog.

{% highlight xml %}
<typeinfo>
  <parsefilecontent>yes</parsefilecontent>
  <skipenvironmentvariables>no</skipenvironmentvariables>
</typeinfo>
{% endhighlight %}

### Components

### Logfiles

