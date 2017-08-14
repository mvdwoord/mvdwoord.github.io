---
layout: post
title: Global Variables in RES Automation Manager
category: exploration
tags:
- T-SQL
- RES Automation Manager
---

Time to do some more digging in RESAM, this time having a look at Global Variables and how they are stored. As it is possible to store secrets in them (credentials / passwords) we might encounter some encryption along the way.

First things first, as we've seen before lots of stuff is stored as XML transformed into binary data in a column of type `image`. I use the following function in my queries to maintain some sanity.
{% highlight sql %}
CREATE FUNCTION [dbo].[XMLfromIMG] 
(
	-- Add the parameters for the function here
	@p1 image
)
RETURNS xml
AS
BEGIN
	-- Declare the return variable here
	DECLARE @Result xml

	-- Add the T-SQL statements to compute the return value here
	SELECT @Result = CAST(REPLACE(CAST(CAST(@p1 AS VARBINARY(MAX)) AS NVARCHAR(MAX)),'UTF-8','UTF-16') AS XML)

	-- Return the result of the function
	RETURN @Result

END

GO
{% endhighlight %} 

Using the SQL profiler we can see the variables are stored in the `imgData1` field of the `tblSettings` table with `lngSetting` 13.
The XML structure is quite straightforward, a quick example after I created some test variables looks like this

{% highlight xml %}
<properties>
  <dispatchercache>
    <timing>ONDEMAND</timing>
  </dispatchercache>
  <launchwindow>10080</launchwindow>
  <variablescontainer>
    <categories />
    <variables>
      <variable>
        <guid>{02502B19-D0ED-4CED-A630-59B3AFA1275C}</guid>
        <name>aaaaa</name>
        <description />
        <type>1</type>
        <parentguid>{00000000-0000-0000-0000-000000000000}</parentguid>
        <details>
          <value1>010D012A0116019F011D</value1>
        </details>
      </variable>
      <variable>
        <guid>{FE31888E-DA1F-4523-8DD7-C84C45B66FA0}</guid>
        <name>a</name>
        <description />
        <type>1</type>
        <parentguid>{00000000-0000-0000-0000-000000000000}</parentguid>
        <details>
          <value1>00C2</value1>
        </details>
      </variable>
{% endhighlight %}

So the value is stored in a format that looks similar to the way passwords are stored in tasks. Although it is easily spotted that this is not the same simple substitution cipher. To make it a bit more clear we can make some more variables and run the following query:

{% highlight sql %}
/*Create a Temporary table to pull out actual XML from the binary data*/
DECLARE @PropTable TABLE (
		PropXML XML NOT NULL
		)

INSERT INTO @PropTable(PropXML)
	SELECT dbo.XMLfromIMG(imgData1)
	FROM tblSettings
	WHERE lngSetting = 13
;

/*Because I want to ORDER on XML values we use a CTE*/
WITH GlobalVariablesCTE AS (
    SELECT  x.l.value('(name/text())[1]', 'nvarchar(max)') as [name],
            x.l.value('(details/value1/text())[1]', 'nvarchar(max)') as [value]
	FROM @PropTable
	CROSS APPLY PropXML.nodes('//variables/variable') x(l)
)
SELECT name, value
FROM GlobalVariablesCTE
ORDER BY Len(name), name
{% endhighlight %}

And here are some results

| name  | value                |
|-------|----------------------|
| a     | 00C2                 |
| b     | 00C3                 |
| c     | 00C4                 |
| d     | 00C5                 |
| aa    | 0082009E             |
| ab    | 008600A1             |
| ac    | 00BA00A0             |
| bb    | 014300EE             |
| cc    | 0104013E             |
| aaaaa | 010D012A0116019F011D |


So there is some base material for our "chosen-plaintext attack". The single character strings at first sight seem to adhere to a similar cipher as we have seen in tasks. From two characters and up we see that the encryption is different though, there no longer is the simple substitution because the second character also influences the way the first character is encoded. With the help of a debugger, lots of patience, some intutition and perhaps some luck, I found that there is a two step encryption process. The secret to be stored is treated as a sequence of bytes, these are encrypted with some as of yet unknown cipher, and the result is passed through our well known vigenere cipher with the key "VaNiLlI92".

In order to zoom in on the inner encryption function here is a table with the secrets, how they are stored, a list of byte values after vigenere decryption and how that results looks like when casted as a string.

| Secret| Stored as            | Raw Bytes 1st decryption  | String |
|-------|----------------------|---------------------------|--------|
| a     | 00C2                 | [97]                      | a      |
| b     | 00C3                 | [98]                      | b      |
| c     | 00C4                 | [99]                      | c      |
| d     | 00C5                 | [100]                     | d      |
| aa    | 0082009E             | [33, 80]                  | !P     |
| ab    | 008600A1             | [37, 83]                  | %S     |
| ac    | 00BA00A0             | [89, 82]                  | YR     |
| bb    | 014300EE             | [226, 160]                | â      |
| cc    | 0104013E             | [163, 240]                | £ð     |
| aaaaa | 010D012A0116019F011D | [172, 220, 173, 339, 177] | ¬Ü­œ±   |

Apparently the inner decryption function does absolutely nothing for single character strings. So if all our secrets were single character.. done. Unfortunately they are not so we have to figure out the inner encryption algorithm. The raw material for analysis is a bit too much but after analyzing various sequences of two, three and more character secrets, more debugging, probably some more luck I got a couple of leads.

It seems the inner encryption function is called with 2 arguments, the sequence of bytes to be encrypted and some sort of a key. The value for that key is `&H12C99FB` or in decimal `19700219`. I might be gullable or perhaps staring at numbers too long but I am willing to bet money that the value is derived from the date 19 February 1970.


| Secret| Stored as            | Raw Bytes 1st decryption  | String |
|-------|----------------------|---------------------------|--------|
| a | 00C2 | [97] | a |
| b | 00C3 | [98] | b |
| c | 00C4 | [99] | c |
| d | 00C5 | [100] | d |
| aa | 0082009E | [33, 80] | !P |
| ab | 008600A1 | [37, 83] | %S |
| ac | 00BA00A0 | [89, 82] | YR |
| bb | 014300EE | [226, 160] | â  |
| cc | 0104013E | [163, 240] | £ð |
| aaa | 00FE00CA0085 | [157, 124, 28] | | |
| aab | 00DB00F60144 | [122, 168, 219] | z¨Û |
| aac | 0138006200BF | [215, 20, 86] | ×V |
| aad | 00D5008E007E | [116, 64, 21] | t@ |
| aba | 00EE20870115 | [141, 8249, 172] | ‹¬ |
| aca | 00EE206100D5 | [141, 8211, 108] | –l |
| ada | 015E0073010D | [253, 37, 164] | ý%¤ |
| baa | 014E00A900B8 | [237, 91, 79] | í[O |
| caa | 00EE010400D7 | [141, 182, 110] | ¶n |
| daa | 00FE00A300EA | [157, 85, 129] | U |
| aaaaa | 010D012A0116019F011D | [172, 220, 173, 339, 177] | ¬Ü­œ± |
| All your base are belong to us | 014F01050110 0146207F01DB0 0F7006B01540 0F0007E0096 011300880325 00AC006201B6 00C3009C01060 1190091010A0 0850034009A0 0C8206C006C | [238, 183, 167, 250, 8211, 402, 190, 57, 254, 143, 48, 45, 199, 28, 732, 115, 48, 352, 98, 78, 157, 205, 37, 193, 76, 2, 68, 103, 8222, 3] | î·§ú–ƒ¾9þ0-Ç˜s0ŠbNÍ%ÁLDg„ |