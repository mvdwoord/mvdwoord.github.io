---
title: Exploring the Python AST
layout: post
category: exploration
tags:
- Python
- meta-programming
---
Whilst working on, and learning about, a python wrapper around a WebAPI it came to the point of writing some tests. Because I want to test my code, and not the underlying API I am learning about mocking. To mock the API (and for checking coverage of the API) it is desirable to have an exhaustive list of all the API endpoints. This list could be obtained from the documentation (scraping) or in this case by looking at the scripts that generate the documentation.

<!-- more -->

Since the sourcecode of the API is available, I figured it would be interesting to look at all actual endpoint definitions. Perhaps the documentation is incomplete, or certain endpoints are masked/hidden. Looking at the sources, the endpoints are all encoded as decorated functions. The decorator specifies the route as well as certain characteristics (description / status codes). Example:

{% highlight python %}
    @Route.get(
        r"/projects",
        description="List projects",
        status_codes={
            200: "List of projects",
        })
    def list_projects(request, response):
        controller = Controller.instance()
        response.json([p for p in controller.projects.values()])
{% endhighlight %}

When assuming a certain coding style, this could probably be done with a handful of lines or even a regex. This becomes problematic if youu want to be able to properly parse any and all (valid) python code. You'll soon find yourself reinventing the (lexer-)wheel which is already available in Python itsself. Thanks to others, there is a built-in ast module which parses Python source code into an AST. The AST can then be inspected and modified, and even unparsed into source code. So the goal is to write a function that takes some source code (file) and given a decorator, returns a list of functions and their interesting properties which have that decorator applied.


The built-in `ast` module allows us to parse arbitrary python code into a tree object as well as dump the tree. The layout of such dumps is unfortunately not very nice. A helpful package here is `astunparse` which provides a `dump()` method which is nicely indented and helps exploring. Additional benefit is that it also provides an `unparse()` method which turns an AST back into source code. We will use this functionality later, et's have a quick look at a simple example of basic parsing.

{% highlight python %}
import ast
import astunparse

example_module = '''
@my_decorator
def my_function(my_argument):
    """My Docstring"""
    my_value = 420
    return my_value
    
def foo():
    pass
    
@Some_decorator
@Another_decorator
def bar():
    pass
    
@MyClass.subpackage.my_deco_function    
def baz():
    pass'''

tree = ast.parse(example_module)
print(tree) # the object
{% endhighlight %}

	<_ast.Module object at 0x10ec9d668>

So the snippet is parsed as an ast.Module object which is the root node of our Abstract Syntax Tree. Let;s have a look at it by using `astunparse.dump()`

{% highlight python %}
print(astunparse.dump(tree))
{% endhighlight %}

	Module(body=[
	  FunctionDef(
	    name='my_function',
	    args=arguments(
	      args=[arg(
	        arg='my_argument',
	        annotation=None)],
	      vararg=None,
	      kwonlyargs=[],
	      kw_defaults=[],
	      kwarg=None,
	      defaults=[]),
	    body=[
	      Expr(value=Str(s='My Docstring')),
	      Assign(
	        targets=[Name(
	          id='my_value',
	          ctx=Store())],
	        value=Num(n=420)),
	      Return(value=Name(
	        id='my_value',
	        ctx=Load()))],
	    decorator_list=[Name(
	      id='my_decorator',
	      ctx=Load())],
	    returns=None),
	  FunctionDef(
	    name='foo',
	    args=arguments(
	      args=[],
	      vararg=None,
	      kwonlyargs=[],
	      kw_defaults=[],
	      kwarg=None,
	      defaults=[]),
	    body=[Pass()],
	    decorator_list=[],
	    returns=None),
	  FunctionDef(
	    name='bar',
	    args=arguments(
	      args=[],
	      vararg=None,
	      kwonlyargs=[],
	      kw_defaults=[],
	      kwarg=None,
	      defaults=[]),
	    body=[Pass()],
	    decorator_list=[
	      Name(
	        id='Some_decorator',
	        ctx=Load()),
	      Name(
	        id='Another_decorator',
	        ctx=Load())],
	    returns=None),
	  FunctionDef(
	    name='baz',
	    args=arguments(
	      args=[],
	      vararg=None,
	      kwonlyargs=[],
	      kw_defaults=[],
	      kwarg=None,
	      defaults=[]),
	    body=[Pass()],
	    decorator_list=[Attribute(
	      value=Attribute(
	        value=Name(
	          id='MyClass',
	          ctx=Load()),
	        attr='subpackage',
	        ctx=Load()),
	      attr='my_deco_function',
	      ctx=Load())],
	    returns=None)])

Quite a mouthful but thanks to the indentation easy to spot 4 top level `FunctionDef` objects which correspond to the four function definitions in our snippet. This is the actual intermediate representation used by the python compiler to generate bytecode. The different types of node you see here are the actual internal building blocks of the Python language and the best reference I could find was in the source code. The tree of objects all inherit from ast.AST and the actual types and their properties can be found in the so called ASDL. The actual grammar of python as defined in the Zephyr Abstract Syntax Definition Language. The grammar file resides in the Python sources at [Parser/python.asdl](https://github.com/python/cpython/blob/master/Parser/Python.asdl).

We want to look at function definitions which are aptly named FunctionDef in the ASDL and represented as FunctionDef objects in the tree. Looking at the ASDL we see the following deifnition for FunctionDef (reformatted):

    FunctionDef(identifier name,
                arguments args,
                stmt* body,
                expr* decorator_list,
                expr? returns,
                string? docstring)
                
Which seems to correspond to the structure of the object in the AST as shown in the astunparse dump above. There is some documentation at a place called [Green Tree Snakes](https://greentreesnakes.readthedocs.io/en/latest/nodes.html#function-and-class-definitions) which explains the components of the FunctionDef object. After looking through it a couple of times, I found it easiest just to use the ASDL directly.

## Traversing and inspecting the tree

There are two ways to work with the tree. The easiest is `ast.walk(node)` which "Recursively yields all descendant nodes in the tree starting at node (including node itself), in no specified order." and apparently does so breadth first. Alternatively you can subclass the `ast.NodeVisitor` class. This class provides a `visit()` method which does a depth first traversal. You can override `visit_<Class_Name>` which are called whenever the traversal hits a node of type `<Class_Name>`. To show the different order, let's use them both and print the nodes.

{% highlight python %}
class MyVisitor(ast.NodeVisitor):
    def generic_visit(self, node):
        print(f'Nodetype: {type(node).__name__:{16}} {node}')
        ast.NodeVisitor.generic_visit(self, node)
        

v = MyVisitor()
print('Using NodeVisitor (depth first):')
v.visit(tree)

print('\nWalk()ing the tree breadth first:')
for node in ast.walk(tree):
    print(f'Nodetype: {type(node).__name__:{16}} {node}')
{% endhighlight %}

For our purposes we should be able to use the walk method, I find it simpler to use for now and honestly I need to investigate this visitor class more to better understand how to use it. My initial issue is figuring out how to yeild values in a pythonic way, without the use of a global variable. Guessing I could stick the class inside a function but leave it for some other time. 

Let's see what happens if we use the `ast.walk(tree)` method to grab those `FunctionDef` objects and inspect them in the same way. Using the `unparse()` method of `astunparse` we can transform it back into source code for extra fun.

{% highlight python %}
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef):
        print(f'Nodetype: {type(node).__name__:{16}} {node}')
        print(astunparse.unparse(node))
{% endhighlight %}

	Nodetype: FunctionDef      <_ast.FunctionDef object at 0x10ec9d6a0>


	@my_decorator
	def my_function(my_argument):
	    'My Docstring'
	    my_value = 420
	    return my_value

	Nodetype: FunctionDef      <_ast.FunctionDef object at 0x10ec9d908>


	def foo():
	    pass

	Nodetype: FunctionDef      <_ast.FunctionDef object at 0x10ec9d9b0>


	@Some_decorator
	@Another_decorator
	def bar():
	    pass

	Nodetype: FunctionDef      <_ast.FunctionDef object at 0x10ec9dac8>


	@MyClass.subpackage.my_deco_function
	def baz():
	    pass

We wanted to only grab functions who have a certain decorator, so we need to inspect the `decorator_list` attribute of the `FunctionDef` class and devise some way of filtering based on that attribute. First naive attempt would be:


{% highlight python %}
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef):
        decorators = [d.id for d in node.decorator_list]
        print(node.name, decorators)
{% endhighlight %}

	my_function ['my_decorator']
	foo []
	bar ['Some_decorator', 'Another_decorator']

	---------------------------------------------------------------------------
	AttributeError                            Traceback (most recent call last)
	<ipython-input-7-666517aaaecf> in <module>()
	      1 for node in ast.walk(tree):
	      2     if isinstance(node, ast.FunctionDef):
	----> 3         decorators = [d.id for d in node.decorator_list]
	      4         print(node.name, decorators)

	<ipython-input-7-666517aaaecf> in <listcomp>(.0)
	      1 for node in ast.walk(tree):
	      2     if isinstance(node, ast.FunctionDef):
	----> 3         decorators = [d.id for d in node.decorator_list]
	      4         print(node.name, decorators)

	AttributeError: 'Attribute' object has no attribute 'id'

So looking more closely there is a different representation in the AST for a single keyword (`@function`) decorator as there is for a compound (`@Class.method`). Compare the decorator in `my_function`:

	decorator_list=[Name(
	      id='my_decorator',
	      ctx=Load())]

against the compound decorator in `baz`:

    decorator_list=[Attribute(
          value=Attribute(
            value=Name(
              id='MyClass',
              ctx=Load()),
            attr='subpackage',
            ctx=Load()),
          attr='my_deco_function',
          ctx=Load())]

So we need to modify our treewalk to accomodate for this. When the top level element in the decorator_list is of type `Name`, we grab the id and be done with it. If it is of type `Attribute` we need to do some more extra work. From the ASDL we can see that Attribute is a nested element:

    Attribute(expr value, identifier attr, expr_context ctx)
    
Assuming it's nested `ast.Attribute`s with a `ast.Name` at the root we can define a flattening function as follows:

{% highlight python %}
def flatten_attr(node):
    if isinstance(node, ast.Attribute):
        return str(flatten_attr(node.value)) + '.' + node.attr
    elif isinstance(node, ast.Name):
        return str(node.id)
    else:
        pass

for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef):
        found_decorators = []
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Name):
                found_decorators.append(decorator.id)
            elif isinstance(decorator, ast.Attribute):
                    found_decorators.append(flatten_attr(decorator))
            
                
        print(node.name, found_decorators)
{% endhighlight %}

	my_function ['my_decorator']
	foo []
	bar ['Some_decorator', 'Another_decorator']
	baz ['MyClass.subpackage.my_deco_function']

Much better, however the actual sources I want to parse have an additional complication, the decorator functions have arguments passed into them. And I want to know what's in them as well. So let's switch to some actual source code and see how to do that. I have removed the body of the function as we are only interested in the decorator now.

{% highlight python %}
source = """
@Route.get(
    r"/projects/{project_id}/snapshots",
    description="List snapshots of a project",
    parameters={
        "project_id": "Project UUID",
    },
    status_codes={
        200: "Snasphot list returned",
        404: "The project doesn't exist"
    })
def list(request, response):
    pass"""

print(astunparse.dump(ast.parse(source)))
{% endhighlight %}

	Module(body=[FunctionDef(
	  name='list',
	  args=arguments(
	    args=[
	      arg(
	        arg='request',
	        annotation=None),
	      arg(
	        arg='response',
	        annotation=None)],
	    vararg=None,
	    kwonlyargs=[],
	    kw_defaults=[],
	    kwarg=None,
	    defaults=[]),
	  body=[Pass()],
	  decorator_list=[Call(
	    func=Attribute(
	      value=Name(
	        id='Route',
	        ctx=Load()),
	      attr='get',
	      ctx=Load()),
	    args=[Str(s='/projects/{project_id}/snapshots')],
	    keywords=[
	      keyword(
	        arg='description',
	        value=Str(s='List snapshots of a project')),
	      keyword(
	        arg='parameters',
	        value=Dict(
	          keys=[Str(s='project_id')],
	          values=[Str(s='Project UUID')])),
	      keyword(
	        arg='status_codes',
	        value=Dict(
	          keys=[
	            Num(n=200),
	            Num(n=404)],
	          values=[
	            Str(s='Snasphot list returned'),
	            Str(s="The project doesn't exist")]))])],
	  returns=None)])

We find the decorator_list to contain a ast.Call object rather than a Name or Attribute. This corresponds to the signature of the called decorator function. I am interested in the first positional argument as well as the keyword arguments. Let's grab the `[0]` element of the decorator list to simplify.


{% highlight python %}
complex_decorator = ast.parse(source).body[0].decorator_list[0]
print(astunparse.dump(complex_decorator))
{% endhighlight %}

	Call(
	  func=Attribute(
	    value=Name(
	      id='Route',
	      ctx=Load()),
	    attr='get',
	    ctx=Load()),
	  args=[Str(s='/projects/{project_id}/snapshots')],
	  keywords=[
	    keyword(
	      arg='description',
	      value=Str(s='List snapshots of a project')),
	    keyword(
	      arg='parameters',
	      value=Dict(
	        keys=[Str(s='project_id')],
	        values=[Str(s='Project UUID')])),
	    keyword(
	      arg='status_codes',
	      value=Dict(
	        keys=[
	          Num(n=200),
	          Num(n=404)],
	        values=[
	          Str(s='Snasphot list returned'),
	          Str(s="The project doesn't exist")]))])

Returning to the original task, let;s try and grab the data that is of actual interest to us:

{% highlight python %}
decorator_name = flatten_attr(complex_decorator.func)
decorator_path = complex_decorator.args[0].s
for kw in complex_decorator.keywords:
    if kw.arg == 'description':
        decorator_description = kw.value.s
    if kw.arg == 'parameters':
        decorator_parameters = ast.literal_eval(astunparse.unparse(kw.value))
    if kw.arg == 'status_codes':
        decorator_statuscodes = ast.literal_eval(astunparse.unparse(kw.value))

print(decorator_name, decorator_path)
print('Parameters:')
for p in decorator_parameters.keys():
    print('  ' + str(p) + ': ' + decorator_parameters[p])    
print('Status Codes:')
for sc in decorator_statuscodes.keys():
    print('  ' + str(sc) + ': ' + decorator_statuscodes[sc])
{% endhighlight %}

	Route.get /projects/{project_id}/snapshots
	Parameters:
	  project_id: Project UUID
	Status Codes:
	  200: Snasphot list returned
	  404: The project doesn't exist

That looks perfect, so now to bring it all together and write a function that takes a filename and a decorator as argument and spits out a list of tuples which hold the:

	- filename in which the function was found
    - Function name (str)
    - The name of the decorator
    - description for the given decorator (str)
    - parameters for the decorator (dict)
    - status codes for the decorator (dict)

for every function in the sourcefile which is decorated with that decorator. I have the current working version for parsing some files in the GNS3 source code:

{% highlight python %}
import ast
import astunparse
import collections
from pathlib import Path

Route = collections.namedtuple('Route',
                               'filename decorator_name function_name path \
                               description parameters status_codes')


def flatten_attr(node):
    if isinstance(node, ast.Attribute):
        return str(flatten_attr(node.value)) + '.' + node.attr
    elif isinstance(node, ast.Name):
        return str(node.id)
    else:
        pass


def extract_routes(file, decorator_name):
    routes = []
    filename = file
    with open(file) as f:
        try:
            tree = ast.parse(f.read())
        except:
            return routes

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            function_name = node.name
            for d in node.decorator_list:
                if not isinstance(d, ast.Call):
                    continue
                if not flatten_attr(d.func) == decorator_name:
                    continue
                path = d.args[0].s
                description = None
                parameters = None
                status_codes = None
                for kw in d.keywords:
                    if kw.arg == 'description':
                        description = kw.value.s
                    if kw.arg == 'parameters':
                        parameters = ast.literal_eval(astunparse.unparse(kw.value))
                    if kw.arg == 'status_codes':
                        status_codes = ast.literal_eval(astunparse.unparse(kw.value))
                r = Route(filename, decorator_name, function_name, path, description, parameters,
                          status_codes)
                routes.append(r)

    return routes


all_routes = []

files = Path('./controller').glob('*.py')
for file in files:
    # because path is object not string
    file_path = str(file)
    all_routes += extract_routes(file_path, 'Route.get')
    all_routes += extract_routes(file_path, 'Route.post')
    all_routes += extract_routes(file_path, 'Route.put')
    all_routes += extract_routes(file_path, 'Route.delete')

for route in all_routes:
    print(
        f'{route.decorator_name:{12}}  {route.path:{70}} {route.description:{40}}')
{% endhighlight %}

	Route.get     /computes                                                              List of compute servers                 
	Route.get     /computes/{compute_id}/{emulator}/images                               Return the list of images available on compute and controller for this emulator type
	Route.get     /computes/{compute_id}/{emulator}/{action:.+}                          Forward call specific to compute node. Read the full compute API for available actions
	Route.get     /computes/{compute_id}                                                 Get a compute server information        
	Route.post    /computes                                                              Register a compute server               
	Route.post    /computes/{compute_id}/{emulator}/{action:.+}                          Forward call specific to compute node. Read the full compute API for available actions
	Route.put     /computes/{compute_id}                                                 Get a compute server information        
	Route.delete  /computes/{compute_id}                                                 Delete a compute instance               
	Route.get     /projects/{project_id}/drawings                                        List drawings of a project              
	Route.post    /projects/{project_id}/drawings                                        Create a new drawing instance           
	Route.put     /projects/{project_id}/drawings/{drawing_id}                           Create a new drawing instance           
	Route.delete  /projects/{project_id}/drawings/{drawing_id}                           Delete a drawing instance               
	Route.get     /gns3vm/engines                                                        Return the list of engines supported for the GNS3VM
	Route.get     /gns3vm/engines/{engine}/vms                                           Get all the available VMs for a specific virtualization engine
	Route.get     /gns3vm                                                                Get GNS3 VM settings                    
	Route.put     /gns3vm                                                                Update GNS3 VM settings                 
	Route.get     /projects/{project_id}/links                                           List links of a project                 
	Route.get     /projects/{project_id}/links/{link_id}/pcap                            Stream the pcap capture file            
	Route.post    /projects/{project_id}/links                                           Create a new link instance              
	Route.post    /projects/{project_id}/links/{link_id}/start_capture                   Start capture on a link instance. By default we consider it as an Ethernet link
	Route.post    /projects/{project_id}/links/{link_id}/stop_capture                    Stop capture on a link instance         
	Route.put     /projects/{project_id}/links/{link_id}                                 Update a link instance                  
	Route.delete  /projects/{project_id}/links/{link_id}                                 Delete a link instance                  
	Route.get     /projects/{project_id}/nodes/{node_id}                                 Update a node instance                  
	Route.get     /projects/{project_id}/nodes                                           List nodes of a project                 
	Route.get     /projects/{project_id}/nodes/{node_id}/dynamips/auto_idlepc            Compute the IDLE PC for a Dynamips node 
	Route.get     /projects/{project_id}/nodes/{node_id}/dynamips/idlepc_proposals       Compute a list of potential idle PC for a node
	Route.get     /projects/{project_id}/nodes/{node_id}/files/{path:.+}                 Get a file in the node directory        
	Route.post    /projects/{project_id}/nodes                                           Create a new node instance              
	Route.post    /projects/{project_id}/nodes/start                                     Start all nodes belonging to the project
	Route.post    /projects/{project_id}/nodes/stop                                      Stop all nodes belonging to the project 
	Route.post    /projects/{project_id}/nodes/suspend                                   Suspend all nodes belonging to the project
	Route.post    /projects/{project_id}/nodes/reload                                    Reload all nodes belonging to the project
	Route.post    /projects/{project_id}/nodes/{node_id}/start                           Start a node instance                   
	Route.post    /projects/{project_id}/nodes/{node_id}/stop                            Stop a node instance                    
	Route.post    /projects/{project_id}/nodes/{node_id}/suspend                         Suspend a node instance                 
	Route.post    /projects/{project_id}/nodes/{node_id}/reload                          Reload a node instance                  
	Route.post    /projects/{project_id}/nodes/{node_id}/files/{path:.+}                 Write a file in the node directory      
	Route.put     /projects/{project_id}/nodes/{node_id}                                 Update a node instance                  
	Route.delete  /projects/{project_id}/nodes/{node_id}                                 Delete a node instance                  
	Route.get     /projects                                                              List projects                           
	Route.get     /projects/{project_id}                                                 Get a project                           
	Route.get     /projects/{project_id}/notifications                                   Receive notifications about projects    
	Route.get     /projects/{project_id}/notifications/ws                                Receive notifications about projects from a Websocket
	Route.get     /projects/{project_id}/export                                          Export a project as a portable archive  
	Route.get     /projects/{project_id}/files/{path:.+}                                 Get a file from a project. Beware you have warranty to be able to access only to file global to the project (for example README.txt)
	Route.post    /projects                                                              Create a new project on the server      
	Route.post    /projects/{project_id}/close                                           Close a project                         
	Route.post    /projects/{project_id}/open                                            Open a project                          
	Route.post    /projects/load                                                         Open a project (only local server)      
	Route.post    /projects/{project_id}/import                                          Import a project from a portable archive
	Route.post    /projects/{project_id}/duplicate                                       Duplicate a project                     
	Route.post    /projects/{project_id}/files/{path:.+}                                 Write a file to a project               
	Route.put     /projects/{project_id}                                                 Update a project instance               
	Route.delete  /projects/{project_id}                                                 Delete a project from disk              
	Route.get     /version                                                               Retrieve the server version number      
	Route.get     /settings                                                              Retrieve gui settings from the server. Temporary will we removed in later release
	Route.post    /shutdown                                                              Shutdown the local server               
	Route.post    /version                                                               Check if version is the same as the server
	Route.post    /settings                                                              Write gui settings on the server. Temporary will we removed in later releas
	Route.post    /debug                                                                 Dump debug informations to disk (debug directory in config directory). Work only for local server
	Route.get     /symbols                                                               List of symbols                         
	Route.get     /symbols/{symbol_id:.+}/raw                                            Get the symbol file                     
	Route.post    /symbols/{symbol_id:.+}/raw                                            Write the symbol file      

This can be used as input for generating the mocked API calls, checking coverage etc etc. And more in general, I think this is a very powerful tool to analyze python code / do some meta-programming and now at least I know a little bit about how to use it.