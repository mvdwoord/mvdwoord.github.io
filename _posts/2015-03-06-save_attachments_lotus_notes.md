---
layout: post
title: Save All Attachments in Lotus Notes
category: tools
tags:
- Lotus Notes
- LotusScript
- Agent
---
Because of reasons, I have this Lotus Notes mailbox and occasionally I receive a whole bunch of documents through some automated process. I was hoping to use a mail processing rule to strip the attachments as mail file size is very much still limited in this environment. Unfortunately there is no, or at least I could not find any, mail rule action to save attachments. Fortunately you can always craft an Agent in either LotusScript or Java to do pretty much whatever you want.

I opted for a very simple and slightly more generic solution and created an Agent which triggers via an “Action menu selection” with “All selected documents” as target. It pops up a file dialog so you can pick a folder, then saves all attachments from all emails you selected. All code is obviously taken from other people, all of whom solved parts of this before I did, I just put the parts together, rearranged it a bit,

{% highlight vbnet %}
Sub Initialize
     
    REM Very fragile code ahead!
    REM Use at your own risk.
    Dim session As New NotesSession
    Dim db As NotesDatabase
    Dim coll As NotesDocumentCollection
    Dim doc As NotesDocument
    Dim eo As NotesEmbeddedObject
    Dim RTITEM As NOTESrICHtEXTiTEM
    Dim ws As New NotesUIWorkspace
     
    AttachmentCount = 0
    Set db = session.CurrentDatabase
    Set coll = db.UnprocessedDocuments
     
    REM This uses the savefiledialog to obtain a folder path
    REM It passes a space character as filename
    REM Trimming and or errorhandling would be nice
    varPaths = ws.SaveFileDialog(False,"File name",, "~", " ")
    If Not Isempty( varPaths ) Then
        selectOutputFolder = varPaths(0)
        strOutputFolder = Cstr(selectOutputFolder)
    Else
        Exit Sub
    End If
     
    REM This bit loops over all selected documents
    REM Then over all attachments and saves them to disk
    For a=1 To coll.count     
         
        Set doc = coll.GetNthDocument(a)     
        Set rtitem = doc.GetFirstItem("Body")     
         
        Forall o In rtitem.EmbeddedObjects
            oname = strOutputFolder + o.name
            Call o.ExtractFile( oname )
            AttachmentCount = AttachmentCount + 1
        End Forall
         
    Next
     
    REM finally show a summary of what happened 
    Messagebox "Saved " _
    + Cstr(AttachmentCount) _
    + " attachment(s) in:" _
    + Chr(13) + Chr(13) _
    + strOutputFolder
     
End Sub
{% endhighlight %}


Not very clean, it passes a space character as filename which is then subsequently ignored in the ExtractFile method apparently. Tested in Lotus Notes 9 Social Edition on Ubuntu 14.04, YMMV.