---
layout: post
title: Datastore exploration in RES Automation Manager – Part 3
category: exploration
tags:
- T-SQL
- RES Automation Manager
- XML
---
So I found a bunch of binary data and in the datastore and some of it turned out to be xml which had certain interesting bits of information stored in them. Even though it is relatively straightforward to run a sql profiler while you click around in the console application to find the specific thing you are looking for, I wanted to see if there is some way we can figure out all of the information that is ‘hiding’ in those pieces of XML. It would be nice to have this more or less fully automated as I expect different versions might hold a different set of properties. Also, stuff like job results will probably have some variation in their xml, and they will only show up once you have run one of the corresponding built in tasks.

<!-- more -->

**WARNING: The following code examples should probably be considered a health hazard; once they have been seen, they cannot be unseen. I am somewhat aware that T-SQL is probably not the most practical tool for what I am trying to achieve. I am fully aware of the fact that I’m an idiot for trying anyway. Here goes nothing.. Proceed at your own risk.**

Since not all binary columns had XML in them first we need a way to verify if it actually is xml, not some binary data or a just a plain old string. My initial thought was to use TRY CATCH constructions around a CAST or CONVERT or something along those lines. Fortunately SQL Server 2012 introduced the TRY_CONVERT statement which looked like a good fit.

{% highlight sql %}
DECLARE @MaybeXML_1 VARCHAR(MAX)
DECLARE @MaybeXML_2 VARCHAR(MAX)
DECLARE @MaybeXML_3 VARCHAR(MAX)
SET @MaybeXML_1 = '<root><element /></root>'
SET @MaybeXML_2 = '<root><element></root>'
SET @MaybeXML_3 = 'Hello World!'
 
SELECT
    CASE WHEN TRY_CONVERT(xml, @MaybeXML_1) IS NULL
    THEN 'Convert failed'
    ELSE @MaybeXML_1
END AS Result
 
UNION
 
SELECT
    CASE WHEN TRY_CONVERT(xml, @MaybeXML_2) IS NULL
    THEN 'Convert failed'
    ELSE @MaybeXML_2
END AS Result
 
UNION
 
SELECT
    CASE WHEN TRY_CONVERT(xml, @MaybeXML_3) IS NULL
    THEN 'Convert failed'
    ELSE @MaybeXML_3
END AS Result
{% endhighlight %}

Result:

{% highlight bash %}
<root><element /></root>
Convert failed
Hello World!

(3 row(s) affected)
{% endhighlight %}

It seems that SQL server has no problem converting a string to the xml data type. Although probably correct as it would be considered to be a stand-alone text node or something along those lines it does not work well for what I want to achieve here. I could not find a way to alter the behavior of CONVERT or CAST functions such that a ‘normal’ string fails conversion (other than containing at least a ‘<‘ character).
After some searching (and then some more) I stumbled upon the sp_xml_preparedocument procedure which Microsoft tells us:

>“Reads the XML text provided as input, parses the text by using the MSXML parser (Msxmlsql.dll), and provides the parsed document in a state ready for consumption. This parsed document is a tree representation of the various nodes in the XML document: elements, attributes, text, comments, and so on.”

which sounds promising. Double check:

{% highlight sql %}
DECLARE @MaybeXML_1 VARCHAR(MAX)
DECLARE @MaybeXML_2 VARCHAR(MAX)
DECLARE @MaybeXML_3 VARCHAR(MAX)
SET @MaybeXML_1 = '<root><element /></root>'
SET @MaybeXML_2 = '<root><element></root>'
SET @MaybeXML_3 = 'Hello World!'
 
-- Table to store output
DECLARE @TempTable TABLE (Result VARCHAR(MAX))
-- DocHandle to pass to sp_xml_preparedocument
DECLARE @hdoc int
 
-- Wrap it in a TRY CATCH and stuff either the string
-- or the error message in the results table
BEGIN TRY 
    EXEC sp_xml_preparedocument @hdoc OUTPUT, @MaybeXML_1
    INSERT INTO @TempTable SELECT @MaybeXML_1
END TRY
BEGIN CATCH
    INSERT INTO @TempTable SELECT  ERROR_MESSAGE()
END CATCH
 
BEGIN TRY 
    EXEC sp_xml_preparedocument @hdoc OUTPUT, @MaybeXML_2
    INSERT INTO @TempTable SELECT  @MaybeXML_2
END TRY
BEGIN CATCH
    INSERT INTO @TempTable SELECT ERROR_MESSAGE()
END CATCH
 
BEGIN TRY 
    EXEC sp_xml_preparedocument @hdoc OUTPUT, @MaybeXML_3
    INSERT INTO @TempTable SELECT @MaybeXML_3
END TRY
BEGIN CATCH
    INSERT INTO @TempTable SELECT ERROR_MESSAGE()
END CATCH
 
SELECT * FROM @TempTable
{% endhighlight %}

Result:

{% highlight bash %}
<root><element /></root>
The error description is 'End tag 'root' does not match the start tag 'element'.'.
The error description is 'Invalid at the top level of the document.'.
{% endhighlight %}

That looks to do more or less what I want, I’ll roll with it for now. So we have a way to locate all columns of type ‘image’ and check if the contents are more or less XML. Since they do not necessarily have the same structure, even if they are in the same column, the next step is to select all rows for each of these and somehow extract all nodes. I started looking for a way to enumerate the elements in an arbitrary XML document and the first search result is [this piece of code](http://stackoverflow.com/a/2274091) (thanks! [Aaronaught](http://stackexchange.com/users/17239/aaronaught)).

Happily hacking away in SSMS to get this query working, I finally plug in this last bit of code, remove typos etc, and BOOM! 90k results :D oh boy. Lot’s of duplicates in there so just this one more DISTINCT keyword in the right place aaaand…


{% highlight bash %}
(0 row(s) affected)
{% endhighlight %}

Huh? ok, check for typos, fat fingers, undo a couple of times, retry.. nada. WTF?! Try previous, much simpler query.. nothing. No errors, just instantly nothing. And then it hit me; I check the memory and yeah..

>A parsed document is stored in the internal cache of SQL Server. The MSXML parser (Msxmlsql.dll) uses one-eighth the total memory available for SQL Server. To avoid running out of memory, run sp_xml_removedocument to free up the memory.

Restart SQL, tray again.. the query runs for 20 seconds and returns 1082 glorious unique rows. At that exact moment this random spotify playlist I had on in the background starts to play Comptine d’un Autre Été – L’Après Midi by Yann Tiersen. I stare at the results for a moment and they look pretty convincing to me. Time to switch to Rammstein, clean this thing up a bit, add some comments and present you with FrankenQuery™

{% highlight sql %}
-- We'll be needing plenty variables
DECLARE @ColumnID NVARCHAR(MAX)
DECLARE @TableName NVARCHAR(MAX)
DECLARE @Cursor CURSOR
DECLARE @cmd NVARCHAR(MAX)
DECLARE @hdoc int
DECLARE @xmlstring NVARCHAR(MAX)
DECLARE @FieldName VARCHAR(MAX)
DECLARE @BinaryContent VARBINARY(MAX)
DECLARE @xpath NVARCHAR(MAX)
DECLARE @xml XML
 
-- Including some tables to store the intermediate results
DECLARE  @varbinTable TABLE (FieldName varchar(50)
                            ,TableName varchar(50)
                            ,BinaryContent VARBINARY(MAX))
 
DECLARE  @xmlstringTable TABLE (FieldName varchar(50)
                               ,TableName varchar(50)
                               ,validxml NVARCHAR(MAX))
 
DECLARE  @xpathTable TABLE (FieldName varchar(50)
                           ,xpath NVARCHAR(MAX))
 
-- Placeholder for querystring
SET @cmd = ''
  
-- Get all columns of datatype image
SET @Cursor = CURSOR FOR
SELECT CONCAT(TABLE_NAME, '.', COLUMN_NAME)
      ,TABLE_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE DATA_TYPE = 'image'
-- Filter out some tables with actual binary data
AND TABLE_NAME NOT IN ('tblResources'
                      ,'tblTasklets'
                      ,'tblQueryImages')
  
-- Open the cursor and fetch first result
OPEN @Cursor
FETCH NEXT
FROM @Cursor INTO @ColumnID, @TableName
  
-- Iterating over all the ColumnIDs we found
-- selecting all rows and build one big querystring.
-- 
-- Throw a bunch of UNION statements in there
-- to shove all the results in a single table.
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @cmd =  @cmd 
      + 'SELECT '''
      + @ColumnID 
      + ''' AS SourceField, '''
      + @TableName
      + ''' AS TableName, CAST('
      + @ColumnID 
      + ' AS VARBINARY(MAX)) AS Value FROM '
      + @TableName 
      + ' WHERE '
      + @ColumnID  
      + ' IS NOT NULL'
      
    FETCH NEXT
    FROM @Cursor INTO @ColumnID, @TableName
  
    IF @@FETCH_STATUS = 0
    BEGIN
        SET @cmd = @cmd + ' UNION ALL '
    END
END
 
CLOSE @Cursor
DEALLOCATE @Cursor
  
-- and finally execute this monster
INSERT INTO @varbinTable(FieldName, TableName, BinaryContent)
       EXEC(@cmd)
 
--------------------------------------------------------------
-- Loop over the intermediate table and check each
-- binary for xml content
SET @Cursor = CURSOR FOR
SELECT FieldName
      ,TableName
      ,BinaryContent 
FROM @varbinTable
 
OPEN @Cursor
FETCH NEXT
FROM @Cursor INTO @FieldName, @TableName, @BinaryContent
 
WHILE @@FETCH_STATUS = 0
BEGIN
  -- Cast the binary to a string
  -- and abuse the storproc to validate
  BEGIN TRY
    SET @xmlstring = CAST(@BinaryContent AS NVARCHAR(MAX))
 
    -- To circumvent any declaration codepage issues
    -- remove them when found!
    IF SUBSTRING(@xmlstring,1,2) = N'<?'
    BEGIN
      SET @xmlstring = 
             SUBSTRING(@xmlstring 
                      ,CHARINDEX('>',@xmlstring ,0)+1
                      ,LEN(@xmlstring))
    END
 
    -- This is where the magic happens, haha.
    EXEC sp_xml_preparedocument @hdoc OUTPUT, @xmlstring
    INSERT INTO @xmlstringTable SELECT DISTINCT @FieldName
                                               ,@TableName
                                               ,@xmlstring
    -- And tidy up afterwards
    EXEC sp_xml_removedocument @hdoc
 
  END TRY
  BEGIN CATCH
      -- No need to catch anything. sp will print nice error
      -- Use that to verify it only skips non-XML strings
  END CATCH
 
  FETCH NEXT
  FROM @Cursor INTO @FieldName, @TableName, @BinaryContent
 
END
 
-- more cleanup
CLOSE @Cursor
DEALLOCATE @Cursor
 
--------------------------------------------------------------
SET @Cursor = CURSOR FOR
SELECT FieldName
      ,validxml
FROM @xmlstringTable
 
 
OPEN @Cursor
FETCH NEXT
FROM @Cursor INTO @FieldName, @xmlstring
WHILE @@FETCH_STATUS = 0
BEGIN
 
SET @xml = CAST(@xmlstring AS XML);
WITH Xml_CTE AS
(
    -- I have NO idea how this works
    SELECT
        CAST('/' + node.value('fn:local-name(.)',
            'varchar(100)') AS varchar(100)) AS name,
        node.query('*') AS children
    FROM @xml.nodes('/*') AS roots(node)
 
    UNION ALL
 
    SELECT
        CAST(x.name + '/' + 
            node.value('fn:local-name(.)'
                      ,'varchar(100)')
                      AS varchar(100)),
            node.query('*') AS children
    FROM Xml_CTE x
    CROSS APPLY x.children.nodes('*') AS child(node)
)
 
INSERT INTO @xpathTable SELECT DISTINCT @FieldName, name
FROM Xml_CTE
OPTION (MAXRECURSION 1000)
 
 
  FETCH NEXT
  FROM @Cursor INTO @FieldName, @xmlstring
END
 
CLOSE @Cursor
DEALLOCATE @Cursor
 
--------------------------------------------------------------
-- Finally (FINALLY) we select the unique results
SELECT DISTINCT * from @xpathTable
{% endhighlight %}

I think even the wordpress sourcecode parser is trying to tell me to stop this nonsense, but nonetheless the query works (at least on my machine) and now we finally have a table with all “hidden properties” in these xml strings trying to hide as binary blobs. It might be helpful in deepening our understanding of the inner workings of AM a bit. This way we can always run it again when a new version comes out. Output from my development environment:

<iframe src="https://docs.google.com/spreadsheets/d/1kyZTAESTPJ0sFt5kRPyv6ant4shwXIFzz85SHsUL-JY/pubhtml?widget=true&amp;headers=false" height="400px" class="gsheet"></iframe>

And the radio is playing.. as if the universe is talking to me:

>Morgenstern ach scheine  
auf die Seele meine  
Wirf ein warmes Licht  
auf ein Herz das bricht  
Sag ihr dass ich weine  
Denn du, du bist hässlich  
Du bist einfach hässlich

Now what about those non-xml binary columns…?