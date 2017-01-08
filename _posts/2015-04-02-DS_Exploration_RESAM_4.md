---
layout: post
title: Datastore exploration in RES Automation Manager – Part 4
category: exploration
tags:
- T-SQL
- RES Automation Manager
- Cryptography
- Vulnerability
- Python
---
Previous queries, exploring binary fields in the datastore, skipped the tables **tblResources**, **tblTasklets**, and **tblQueryImages**. This assumed the columns with a binary datatype in these tables were unlikely to contain ‘hidden’ properties which started this exploration in the first place. According to the official styleguide of the internet, pretentious use of an unverified quote is in order:

>“Your assumptions are your windows on the world. Scrub them off every once in a while, or the light won’t come in.”  
― Isaac Asimov

Initiate scrubbing:
<!-- more -->

#### tblResources

This is where the resources are stored, and shows all the usual suspects in columns with predictable types; GUID, Filename, Enabled, Size, CRC, etc etc. But does it really hold resources? That imgInfo column looks suspicious.. and as it turns out contains even more XML. Apparently the lngType indicates the type of resource and they each get their own bit of XML.

<table>
  <tr>
    <th>Type</th>
    <th>XML Example</th>
  </tr>
  <tr>
    <td>[0] In Datastore</td>
    <td>{% highlight xml %}<typeinfo>
    <parsefilecontent>no</parsefilecontent>
    <skipenvironmentvariables>no</skipenvironmentvariables>
</typeinfo>{% endhighlight %}</td>
  </tr>
  <tr>
    <td>[1] On Fileshare</td>
    <td>{% highlight xml %}<typeinfo>
  <path>\\MyServer\c$\somefolder</path>
    <username>mydomain\SysOp</username>
    <password>00BD00C600D7008C00BA00D700CF00DD008C00B400D7</password>
</typeinfo>{% endhighlight %}</td>
  </tr>
  <tr>
    <td>[3] Resource Package</td>
 <td>{% highlight xml %}<cabfooter>
<info>
    <filecount>1</filecount>
    <foldercount>0</foldercount>
    <size>587776</size>
    <packedsize>308941</packedsize>
</info>
<folders/>
<files>
  <file guid="{5C37C3E9-C402-434D-B35B-C1E5629591F4}" folderguid="">
    <lname xml:space="preserve">7za.exe</lname>
    <name xml:space="preserve">7za.exe</name>
    <attrib>32</attrib>
    <timestamp>01CC09CE5E7C020001CC09CE5E7C020001CC09CE5E7C0200</timestamp>
    <filelen>587776</filelen>
    <crc>1A160D6B</crc>
    <offset>61</offset>
    <len>308941</len>
    <compressed>yes</compressed>
  </file>
</files>
</cabfooter>{% endhighlight %}</td>
  </tr>
</table>

Another interesting use case of XML in the database, makes me wonder why resource packages are stored as they are. But wait, a password field?! It doesn’t look like my password. Is it encrypted? If so how? Quite eager to try out those techniques I read about in my cryptography 101 textbook! Considering we can input arbitrary strings and have AM convert it to it’s encrypted form, this should be relatively straightforward.

Let’s start by systematically gathering some data. I have created several resources, as a link, from the same file, using the same userid, but a different password. I put that same password in the description field for reference and with the following query we can obtain a list of plain text and encrypted passwords.

{% highlight sql %}
SELECT [strComment],
      CAST(
        CAST(
          CAST(
            CAST(imgInfo AS VARBINARY(MAX)) 
          AS NVARCHAR(MAX)) 
        AS XML).query('data(/typeinfo/password)') 
      AS VARCHAR(max))
        
      AS SuperSecretPassword
   
  FROM tblResources
  WHERE lngType = 1
  ORDER BY strComment
{% endhighlight %}

I have formatted the output a little for clarification.

<table>
  <tr>
    <th>PlainText</th>
    <th>CipherText</th>
  </tr>
  <tr>
    <td>a</td>
    <td><pre>00D3</pre></td>
  </tr>
  <tr>
    <td>aa</td>
    <td><pre>00D3 00C2</pre></td>
  </tr>
  <tr>
    <td>aa</td>
    <td><pre>00D3 00C2</pre></td>
  </tr>
  <tr>
    <td>aaaaaaaaaaaaaaaa</td>
    <td><pre>00D3 00C2 00CA 00CD 00A8
00D3 00C2 00CA 00CD 00A8
00D3 00C2 00CA 00CD 00A8
00D3</pre></td>
  </tr>
  <tr>
    <td>ab</td>
    <td><pre>00D3 00C3</pre></td>
  </tr>
  <tr>
    <td>abc</td>
    <td><pre>00D3 00C3 00CC</pre></td>
  </tr>
  <tr>
    <td>abcd..xyz</td>
    <td><pre>00D3 00C3 00CC 00D0 00AC
00D8 00C8 00D1 00D5 00B1
00DD 00CD 00D6 00DA 00B6
00E2 00D2 00DB 00DF 00BB
00E7 00D7 00E0 00E4 00C0
00EC</pre></td>
  </tr>
  <tr>
    <td>ABCD..XYZ</td>
    <td><pre>00B3 00A3 00AC 00B0 008C
00B8 00A8 00B1 00B5 0091
00BD 00AD 00B6 00BA 0096
00C2 00B2 00BB 00BF 009B
00C7 00B7 00C0 00C4 00A0
00CC</pre></td>
  </tr>
</table>

So, immediately we can see the length of the ciphertext is 4 times that of the plain text. The ciphertext seem to be hexadecimal values and repeats every 5 characters worth of plain text. This thing has all the characteristics of a classic Vigenère cipher with a key of length 5. To figure out the key I wrote some snippets of Python. First step is having a couple of lists with plaintext and ciphertext:

{% highlight python %}
PlainTextPWs=['a',
               'aa',
               'aaa',
               'aaaaa',
               'aaaaaaaaaaaaaaaa',
               'abcdefghijklmnopqrstuvwxyz',
               'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
              ]
EncryptedPWs=['00D3',
               '00D300C2',
               '00D300C200CA',
               '00D300C200CA00CD00A8',
               '00D300C200CA00CD00A800D300C200CA00CD00A800D300C200CA00CD00A800D3',
               '00D300C300CC00D000AC00D800C800D100D500B100DD00CD00D600DA00B600E200D200DB00DF00BB00E700D700E000E400C000EC',
               '00B300A300AC00B0008C00B800A800B100B5009100BD00AD00B600BA009600C200B200BB00BF009B00C700B700C000C400A000CC'
              ]
{% endhighlight %}

So basically each character is stored as a 16-bit unit (a.k.a wyde), represented as a hexadecimal string of length 4. This helper function will transform any encrypted string with such an encoding to a list of values:

{% highlight python %}
def HexStringToIntList(s):
    n=4
    return list(map((lambda x: int(x, 16)), [s[i:i+n] for i in range(0, len(s), n)]))
 
for count, value in  enumerate(HexStringToIntList(EncryptedPWs[3])):
    print count, ":", value
{% endhighlight %}

Output:
<pre>
0 : 211
1 : 194
2 : 202
3 : 205
4 : 168
</pre>

The next step is to take the difference of this value with the code point of the plaintext character. Although the output is not particularly nicely formatted I hope it makes some sense.

{% highlight python %}
print "Char :  Enc  -  Val = Diff"
for count, val in  enumerate(zip(PlainTextPWs[5],HexStringToIntList(EncryptedPWs[5]))):
    print format(val[0], '^4'), ": "\
         ,format(val[1], '03d'), " - "\
         ,format(ord(val[0]), '03d'), "="\
         ,format(val[1] - ord(val[0]), '03d'), " ->"\
         ,chr(val[1] - ord(val[0]))
{% endhighlight %}

Output:
<pre>
Char :  Enc  -  Val = Diff
 a   :  211  -  097 = 114  -> r
 b   :  195  -  098 = 097  -> a
 c   :  204  -  099 = 105  -> i
 d   :  208  -  100 = 108  -> l
 e   :  172  -  101 = 071  -> G
 f   :  216  -  102 = 114  -> r
 g   :  200  -  103 = 097  -> a
 h   :  209  -  104 = 105  -> i
 i   :  213  -  105 = 108  -> l
 j   :  177  -  106 = 071  -> G
 k   :  221  -  107 = 114  -> r
 l   :  205  -  108 = 097  -> a
 m   :  214  -  109 = 105  -> i
 n   :  218  -  110 = 108  -> l
 o   :  182  -  111 = 071  -> G
 p   :  226  -  112 = 114  -> r
 q   :  210  -  113 = 097  -> a
 r   :  219  -  114 = 105  -> i
 s   :  223  -  115 = 108  -> l
 t   :  187  -  116 = 071  -> G
 u   :  231  -  117 = 114  -> r
 v   :  215  -  118 = 097  -> a
 w   :  224  -  119 = 105  -> i
 x   :  228  -  120 = 108  -> l
 y   :  192  -  121 = 071  -> G
 z   :  236  -  122 = 114  -> r
</pre>

Bingo! I mean .. railG! but even more likely, the key is ‘Grail’ and we are just having some off by one thing going on. Because I fully expect to encounter similar encryption to be found elsewhere in the software, let’s create encryption/decryption functions, this will also help us in confirming the hypothesis. After all, our sample size is small and theoretically there could be some wildly more complex encryption going on which just happens to show this exact behavior in our chosen examples.

{% highlight python %}
def Encrypt(s, k):
    EncVals = [((ord(c) + ord(k[(i + 1) % len(k)]))) for i,c in enumerate(s)]
    return "".join(map((lambda x: format(x, '04X')),EncVals))
 
def Decrypt(s, k):
    EncryptedVals = HexStringToIntList(s)
    DecryptedVals = [((c - ord(k[(i + 1) % len(k)]))) for i,c in enumerate(EncryptedVals)]
    return "".join(map((lambda x: unichr(x)),DecryptedVals))
 
print 'Encrypted :', Encrypt('Hey, watcha readin\' for?', 'Grail')
print 'Decrypted :', Decrypt('00BA00C600E20098006700E900C200DD00CF00AF00D3008100DB00D100A800D600CA00D70093006700D800D000DB00AB', 'Grail')
{% endhighlight %}

Output:
<pre>
Encrypted : 00BA00C600E20098006700E900C200DD00CF00AF00D3008100DB00D100A800D600CA00D70093006700D800D000DB00AB
Decrypted : Hey, watcha readin' for?
</pre>

So, I may have upset some people with my blatant disregard for Pythonic coding standards. Perhaps, but the code runs and I made a new friend in the Jupyter iPython Notebook. Pretty cool stuff if you ask me. I mean iPython, not 16th century ciphers with a key of length 5 ‘protecting’ my passwords.

#### Update

Running the decryption on a bunch of stuff in the database, I found that the same cipher is used for storing credentials in modules. However not all of them use the same key, but with some help of the notebook it is trivial to figure out what they are. I created a number of different tasks in AM, using the same password and ran them through the iPython notebook I created earlier. The encrypted passwords are stored in XML in the imgTasks column in the tblModules table.

<table>
  <tr>
    <th>XPath in imgData1 (tblModules)</th>
    <th>Key(s)</th>
  </tr>
  <tr>
    <td>/tasks/task/settings/dbpassword</td>
    <td>SQLScript</td>
  </tr>
  <tr>
    <td>/tasks/task/settings/domain/domainpassword</td>
    <td>DomUserPass</td>
  </tr>
  <tr>
    <td>/tasks/task/settings/fileoperationtask/securitycontext/password</td>
    <td>FileOps</td>
  </tr>
  <tr>
    <td>/tasks/task/settings/password</td>
    <td>Grail</td>
  </tr>
  <tr>
    <td></td>
    <td>17FiLeVerSioN1988</td>
  </tr>
  <tr>
    <td></td>
    <td>77DepLoyComPoNent14</td>
  </tr>
  <tr>
    <td></td>
    <td>ActiveDirectory</td>
  </tr>
  <tr>
    <td></td>
    <td>Dune2</td>
  </tr>
  <tr>
    <td></td>
    <td>R3SWFsTuD10</td>
  </tr>
  <tr>
    <td></td>
    <td>RES=Gold</td>
  </tr>
  <tr>
    <td></td>
    <td>Send@Mail</td>
  </tr>
  <tr>
    <td></td>
    <td>SSHCommands</td>
  </tr>
  <tr>
    <td></td>
    <td>TaskDomain</td>
  </tr>
  <tr>
    <td></td>
    <td>WebService</td>
  </tr>
</table>

I’ll leave it up to you to guess which tasks use which key. Also, this list is by no means exhaustive, there were some tasks I could not easily create because the target service is not available in my test environment. I looked for strings in the executable and found some other likely keys.. ‘LANDesk’, ‘SoftGrid’, ‘MicSCCM’, and ‘VirtualInfrastructure’ however since I did not test these myself I cannot be 100% certain.