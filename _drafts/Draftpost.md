---
layout: post
title: Test draft for editing
category: testpages
---
Blergh blah
<!-- more -->

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
    <td>&nbsp;</td><td colspan="2" style="text-align:right;">[NOSSL]00080000</td>
  </tr>
  <tr>
    <td colspan="2">{% highlight xml linenos=table %}
<WISDOM WUID="{6AE2E5B5-D5C8-4728-A10A-12E25BD5F995}" 
        Job="GETDISPATCHERLIST" 
        Name="W2K3-TEST-01" 
        SetStatus="no" 
        wds2was="0" 
        DispatcherListGUID="" 
        incoffline="yes">
</WISDOM>{% endhighlight %}</td><td>&nbsp;</td>
  </tr>
<tr>
    <td>&nbsp;</td><td colspan="2">{% highlight xml %}
<?xml version="1.0" encoding="UTF-16"?>
<DISPATCHERLIST DispatcherListGUID="{D1BE2F8D-456A-4F3B-8322-4E81FBEAF189}">
  <ip guid="{3CCBDB70-2391-46D5-B2AF-6CDF197D0427}" 
      online="yes">
      WIN-TTDNUBI9TNA;192.168.2.110
  </ip>
</DISPATCHERLIST>
{% endhighlight %}</td></tr>
</table>